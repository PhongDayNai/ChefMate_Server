const userEatingSignalModel = require('../models/userEatingSignalModel');
const { SIGNAL_WEIGHTS } = require('./recommendationConstants');

async function appendSignal({ userId, recipeId = null, signalType, source = 'app', context = null, signalWeight = null }) {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0 || !signalType) {
        return false;
    }

    const finalWeight = signalWeight === null || signalWeight === undefined
        ? Number(SIGNAL_WEIGHTS[signalType] || 1)
        : Number(signalWeight || 1);

    try {
        await userEatingSignalModel.appendSignal({
            userId: parsedUserId,
            recipeId,
            signalType,
            signalWeight: finalWeight,
            source,
            context
        });
        return true;
    } catch (error) {
        console.error('Best-effort user signal append failed:', error.message);
        return false;
    }
}

module.exports = {
    appendSignal
};
