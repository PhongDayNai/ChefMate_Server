const PROFILE_DIMENSIONS = [
    'spicy',
    'salty',
    'sweet',
    'sour',
    'oiliness',
    'light',
    'heavy',
    'fried',
    'stir_fried',
    'boiled',
    'steamed',
    'soup',
    'grilled',
    'vegetable',
    'seafood',
    'red_meat',
    'plant_protein',
    'quick_meal'
];

const SIGNAL_WEIGHTS = {
    recipe_view: 1,
    recipe_like: 3,
    recipe_unlike: -2,
    cook_started: 4,
    cook_completed: 6,
    cook_abandoned: -2,
    recommendation_impression: 1,
    recommendation_click: 2,
    recommendation_accept: 5,
    feedback_positive: 4,
    feedback_negative: -3,
    feedback_too_spicy: -4,
    feedback_too_oily: -4,
    feedback_too_heavy: -4,
    feedback_light_preferred: 3
};

module.exports = {
    PROFILE_DIMENSIONS,
    SIGNAL_WEIGHTS
};
