/**
 * AppConstants
 * 
 * Derived from gaussian-splat-renderer-for-lam
 * Animation state constants and ARKit blendshape mappings.
 */

/**
 * Voice chat state enumeration
 * Controls the rendering and behavior modes of the avatar
 */
export const TYVoiceChatState = {
    Idle: 'Idle',           // Idle/waiting state
    Listening: 'Listening', // Listening to user input
    Responding: 'Responding', // Speaking/responding animation
    Thinking: 'Thinking'    // Processing/thinking animation
};

/**
 * ARKit blendshape names (52 expressions)
 * Used for facial expression mapping from ARKit face tracking
 */
export const ARKitBlendshapes = [
    'browDownLeft',
    'browDownRight',
    'browInnerUp',
    'browOuterUpLeft',
    'browOuterUpRight',
    'cheekPuff',
    'cheekSquintLeft',
    'cheekSquintRight',
    'eyeBlinkLeft',
    'eyeBlinkRight',
    'eyeLookDownLeft',
    'eyeLookDownRight',
    'eyeLookInLeft',
    'eyeLookInRight',
    'eyeLookOutLeft',
    'eyeLookOutRight',
    'eyeLookUpLeft',
    'eyeLookUpRight',
    'eyeSquintLeft',
    'eyeSquintRight',
    'eyeWideLeft',
    'eyeWideRight',
    'jawForward',
    'jawLeft',
    'jawOpen',
    'jawRight',
    'mouthClose',
    'mouthDimpleLeft',
    'mouthDimpleRight',
    'mouthFrownLeft',
    'mouthFrownRight',
    'mouthFunnel',
    'mouthLeft',
    'mouthLowerDownLeft',
    'mouthLowerDownRight',
    'mouthPressLeft',
    'mouthPressRight',
    'mouthPucker',
    'mouthRight',
    'mouthRollLower',
    'mouthRollUpper',
    'mouthShrugLower',
    'mouthShrugUpper',
    'mouthSmileLeft',
    'mouthSmileRight',
    'mouthStretchLeft',
    'mouthStretchRight',
    'mouthUpperUpLeft',
    'mouthUpperUpRight',
    'noseSneerLeft',
    'noseSneerRight',
    'tongueOut'
];

/**
 * FLAME model bone names
 */
export const FlameBoneNames = [
    'root',
    'neck',
    'jaw',
    'leftEye',
    'rightEye'
];

/**
 * Constants derived from the arrays
 */
export const ARKIT_BLENDSHAPES_COUNT = ARKitBlendshapes.length;
export const FLAME_BONES_COUNT = FlameBoneNames.length;

export default {
    TYVoiceChatState,
    ARKitBlendshapes,
    FlameBoneNames,
    ARKIT_BLENDSHAPES_COUNT,
    FLAME_BONES_COUNT
};
