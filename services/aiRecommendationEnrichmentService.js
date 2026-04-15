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
    const candidates = [raw];

    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch) candidates.push(objectMatch[0]);

    const fencedJsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedJsonMatch?.[1]) candidates.push(String(fencedJsonMatch[1]).trim());

    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch (_) {
            // continue
        }
    }

    return null;
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

    const nextConfidence = clamp01(Math.max(Number(baseProfile?.confidenceScore || 0), Number(payload?.confidenceScore || 0)));

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
        profilingSource: nextConfidence > Number(baseProfile?.confidenceScore || 0) ? 'hybrid' : 'rule',
        confidenceScore: nextConfidence
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
                'Return strict JSON only with no markdown and no prose.',
                'Never include medical claims.',
                'Do not override dietary safety logic.',
                'Only infer flavor, cookingMethods, nutritionSignals, mealContexts, wellnessFlags, confidenceScore.',
                'All numeric scores must be between 0 and 1.',
                'If uncertain, keep the base profile pattern but refine weak dimensions conservatively.'
            ].join(' ')
        },
        {
            role: 'user',
            content: JSON.stringify({
                dimensions: PROFILE_DIMENSIONS,
                recipe: {
                    recipeId: recipe?.recipeId,
                    recipeName: recipe?.recipeName,
                    tags: (recipe?.tags || []).slice(0, 10).map(tag => tag.tagName || tag),
                    ingredients: (recipe?.ingredients || []).slice(0, 12).map(item => item.ingredientName),
                    textHints: [
                        recipe?.recipeName || '',
                        ...(recipe?.tags || []).slice(0, 10).map(tag => tag.tagName || tag),
                        ...(recipe?.ingredients || []).slice(0, 12).map(item => item.ingredientName)
                    ].filter(Boolean).join(', ')
                },
                baseProfile,
                outputExample: {
                    flavor: { spicy: 0.1, sweet: 0.2, sour: 0.3, salty: 0.4, light: 0.6, heavy: 0.2, oiliness: 0.1 },
                    cookingMethods: { soup: 0.0, boiled: 0.0, steamed: 0.0, grilled: 0.0, fried: 0.0, stir_fried: 0.0 },
                    nutritionSignals: { vegetable: 0.2, seafood: 0.0, red_meat: 0.0, plant_protein: 0.0, quick_meal: 0.3 },
                    mealContexts: { breakfast: 0.0, lunch: 0.4, dinner: 0.6, light: 0.5, quick_meal: 0.3, weekend: 0.2 },
                    wellnessFlags: { light_meal_friendly: true, heavy_meal: false },
                    confidenceScore: 0.72
                }
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
