const { PROFILE_DIMENSIONS } = require('./recommendationConstants');

const DEFAULT_TIMEOUT_MS = Number(process.env.AI_RECOMMENDATION_ENRICHMENT_TIMEOUT_MS || 12000);
const DEFAULT_MODEL = process.env.AI_RECOMMENDATION_ENRICHMENT_MODEL || process.env.AI_CHAT_FALLBACK_MODEL || 'gpt-5.4-mini';
const FALLBACK_API_URL = process.env.AI_CHAT_FALLBACK_API_URL || '';
const FALLBACK_API_KEY = process.env.AI_CHAT_FALLBACK_API_KEY || process.env.OPENAI_API_KEY || '';

function isAiEnrichmentEnabled() {
    return String(process.env.AI_RECOMMENDATION_ENRICHMENT_ENABLED || 'false').toLowerCase() === 'true';
}

function shouldAiProfileRecipe(baseProfile) {
    const threshold = Number(process.env.AI_RECOMMENDATION_PROFILE_CONFIDENCE_THRESHOLD || 0.65);
    return isAiEnrichmentEnabled() && Number(baseProfile?.confidenceScore || 0) < threshold;
}

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value || 0)));
}

function safeParseJsonFromText(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (_) {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch (_) {
            return null;
        }
    }
}

async function callOpenAICompatible(messages, { temperature = 0.2, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    if (!isAiEnrichmentEnabled() || !FALLBACK_API_URL || !FALLBACK_API_KEY) {
        return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(FALLBACK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FALLBACK_API_KEY}`
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages,
                stream: false,
                temperature
            }),
            signal: controller.signal
        });

        const text = await response.text();
        if (!response.ok) {
            throw new Error(`AI enrichment API failed with status ${response.status}: ${text.slice(0, 300)}`);
        }

        const data = safeParseJsonFromText(text) || (() => {
            try { return JSON.parse(text); } catch (_) { return { raw: text }; }
        })();

        return String(data?.choices?.[0]?.message?.content || data?.choices?.[0]?.delta?.content || data?.assistantMessage || '').trim();
    } finally {
        clearTimeout(timer);
    }
}

function sanitizeProfilePayload(payload, baseProfile) {
    const flavor = { ...(baseProfile?.flavor || {}) };
    const cookingMethods = { ...(baseProfile?.cookingMethods || {}) };
    const nutritionSignals = { ...(baseProfile?.nutritionSignals || {}) };

    for (const key of PROFILE_DIMENSIONS) {
        if (payload?.flavor && key in payload.flavor) flavor[key] = clamp01(payload.flavor[key]);
        if (payload?.cookingMethods && key in payload.cookingMethods) cookingMethods[key] = clamp01(payload.cookingMethods[key]);
        if (payload?.nutritionSignals && key in payload.nutritionSignals) nutritionSignals[key] = clamp01(payload.nutritionSignals[key]);
    }

    return {
        ...baseProfile,
        flavor,
        cookingMethods,
        nutritionSignals,
        mealContexts: payload?.mealContexts && typeof payload.mealContexts === 'object'
            ? payload.mealContexts
            : baseProfile?.mealContexts || {},
        wellnessFlags: payload?.wellnessFlags && typeof payload.wellnessFlags === 'object'
            ? payload.wellnessFlags
            : baseProfile?.wellnessFlags || {},
        profilingSource: 'hybrid',
        confidenceScore: clamp01(Math.max(Number(baseProfile?.confidenceScore || 0), Number(payload?.confidenceScore || 0)))
    };
}

async function enrichRecipeProfileWithAI({ recipe, baseProfile }) {
    if (!shouldAiProfileRecipe(baseProfile)) {
        return baseProfile;
    }

    const messages = [
        {
            role: 'system',
            content: [
                'You enrich recipe profiles for a food recommendation backend.',
                'Return JSON only.',
                'Never include medical claims.',
                'Do not override dietary safety logic.',
                'Only infer flavor, cookingMethods, nutritionSignals, mealContexts, wellnessFlags, confidenceScore.',
                'All numeric scores must be between 0 and 1.'
            ].join(' ')
        },
        {
            role: 'user',
            content: JSON.stringify({
                dimensions: PROFILE_DIMENSIONS,
                recipe: {
                    recipeId: recipe?.recipeId,
                    recipeName: recipe?.recipeName,
                    tags: (recipe?.tags || []).map(tag => tag.tagName || tag),
                    ingredients: (recipe?.ingredients || []).map(item => item.ingredientName),
                    steps: (recipe?.cookingSteps || []).map(step => step.stepContent || step.content)
                },
                baseProfile
            })
        }
    ];

    try {
        const content = await callOpenAICompatible(messages, { temperature: 0.1 });
        const payload = safeParseJsonFromText(content);
        if (!payload || typeof payload !== 'object') {
            return baseProfile;
        }
        return sanitizeProfilePayload(payload, baseProfile);
    } catch (error) {
        console.error('AI recipe profile enrichment failed:', error.message);
        return baseProfile;
    }
}

async function enrichExplanationText({ recipe, recommendation, userProfile, context }) {
    if (!isAiEnrichmentEnabled()) return null;

    const messages = [
        {
            role: 'system',
            content: [
                'You write short, safe food recommendation explanations.',
                'Keep it concise, friendly, and non-medical.',
                'Return JSON only with key summary.',
                'Do not mention hidden scoring internals beyond what is provided.'
            ].join(' ')
        },
        {
            role: 'user',
            content: JSON.stringify({
                context,
                recipe: {
                    recipeId: recipe?.recipeId,
                    recipeName: recipe?.recipeName
                },
                recommendation,
                userProfile: {
                    confidence: userProfile?.profileConfidence,
                    balanceSignals: userProfile?.balanceSignals || {}
                }
            })
        }
    ];

    try {
        const content = await callOpenAICompatible(messages, { temperature: 0.3 });
        const payload = safeParseJsonFromText(content);
        const summary = String(payload?.summary || '').trim();
        return summary || null;
    } catch (error) {
        console.error('AI explanation enrichment failed:', error.message);
        return null;
    }
}

async function enrichInsightMessages(insights = [], userProfile = null) {
    if (!isAiEnrichmentEnabled() || !Array.isArray(insights) || insights.length === 0) {
        return insights;
    }

    const messages = [
        {
            role: 'system',
            content: [
                'You rewrite food habit insight messages for app UX.',
                'Keep them short, calm, non-medical, and grounded in the provided signals.',
                'Return JSON only with key insights as an array of {title,message} preserving order.'
            ].join(' ')
        },
        {
            role: 'user',
            content: JSON.stringify({
                userProfile: {
                    confidence: userProfile?.profileConfidence,
                    balanceSignals: userProfile?.balanceSignals || {}
                },
                insights: insights.map(item => ({ title: item.title, message: item.message }))
            })
        }
    ];

    try {
        const content = await callOpenAICompatible(messages, { temperature: 0.35 });
        const payload = safeParseJsonFromText(content);
        const rewritten = Array.isArray(payload?.insights) ? payload.insights : [];
        return insights.map((item, index) => ({
            ...item,
            title: String(rewritten[index]?.title || item.title || '').trim(),
            message: String(rewritten[index]?.message || item.message || '').trim()
        }));
    } catch (error) {
        console.error('AI insight enrichment failed:', error.message);
        return insights;
    }
}

module.exports = {
    isAiEnrichmentEnabled,
    shouldAiProfileRecipe,
    enrichRecipeProfileWithAI,
    enrichExplanationText,
    enrichInsightMessages
};
