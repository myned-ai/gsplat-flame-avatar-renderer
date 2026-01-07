/**
 * AnimationManager
 *
 * Derived from gaussian-splat-renderer-for-lam
 * Manages animation state machine with Three.js AnimationMixer.
 */

import { LoopOnce, LoopRepeat } from 'three';
import { TYVoiceChatState } from './AppConstants.js';
import { getLogger } from '../utils/Logger.js';

const logger = getLogger('AnimationManager');

/**
 * Base State class for animation states
 */
class State {
    constructor(actions, isGroup) {
        this.isPlaying = false;
        this.stage = 0;
        this.actions = actions || [];
        this.blendingTime = 0.5;
        this.isGroup = isGroup || false;
    }

    dispose() {
        this.actions = [];
    }

    update(state) {
        // Override in subclasses
    }
}

/**
 * Hello state - initial greeting animation
 */
class Hello extends State {
    constructor(actions, isGroup) {
        super(actions, isGroup);
    }

    update(state) {
        // Safety check: return early if no actions available
        if (!this.actions || this.actions.length === 0) return;
        
        if (AnimationManager.CurPlaying === undefined &&
            state === TYVoiceChatState.Idle &&
            this.isPlaying === false) {
            this.stage = 0;
            this.actions[this.stage].time = 0;
            AnimationManager.SetWeight(this.actions[this.stage], 1.0);
            this.actions[this.stage].loop = LoopRepeat;
            this.actions[this.stage].clampWhenFinished = false;
            this.actions[this.stage].paused = false;
            this.actions[this.stage].play();
            if (AnimationManager.LastAction !== undefined) {
                AnimationManager.PrepareCrossFade(AnimationManager.LastAction, this.actions[this.stage], this.blendingTime);
            }
            this.isPlaying = true;
        }

        if (AnimationManager.CurPlaying === TYVoiceChatState.Idle &&
            state === TYVoiceChatState.Idle &&
            this.isPlaying === true) {
            if (this.actions[this.stage].time >
                this.actions[this.stage].getClip().duration - this.blendingTime) {
                let nextStage = this.stage + 1;
                if (nextStage >= this.actions.length) nextStage = 0;
                this.actions[nextStage].time = 0;
                AnimationManager.SetWeight(this.actions[nextStage], 1.0);
                this.actions[nextStage].loop = LoopRepeat;
                this.actions[nextStage].play();
                AnimationManager.PrepareCrossFade(this.actions[this.stage], this.actions[nextStage], this.blendingTime);
                this.stage = nextStage;
            }
        }
    }
}

/**
 * Idle state - resting animation
 */
class Idle extends State {
    constructor(actions, isGroup) {
        super(actions, isGroup);
    }

    update(state) {
        // Safety check: return early if no actions available
        if (!this.actions || this.actions.length === 0) return;
        
        if (AnimationManager.CurPlaying === undefined &&
            state === TYVoiceChatState.Idle &&
            this.isPlaying === false) {
            this.stage = 0;
            this.actions[this.stage].time = 0;
            AnimationManager.SetWeight(this.actions[this.stage], 1.0);
            this.actions[this.stage].loop = LoopRepeat;
            this.actions[this.stage].clampWhenFinished = false;
            this.actions[this.stage].paused = false;
            this.actions[this.stage].play();
            if (AnimationManager.LastAction !== undefined) {
                AnimationManager.PrepareCrossFade(AnimationManager.LastAction, this.actions[this.stage], this.blendingTime);
            }
            this.isPlaying = true;
        }

        if (AnimationManager.CurPlaying === TYVoiceChatState.Idle &&
            state !== TYVoiceChatState.Idle &&
            this.isPlaying === true &&
            this.stage === 0) {
            this.actions[this.stage].loop = LoopOnce;
            this.actions[this.stage].clampWhenFinished = true;
            this.isPlaying = false;
            AnimationManager.LastAction = this.actions[this.stage];
        }
    }
}

/**
 * Listen state - listening animation
 */
class Listen extends State {
    constructor(actions, isGroup) {
        super(actions, isGroup);
    }

    update(state) {
        // Safety check: return early if no actions available
        if (!this.actions || this.actions.length === 0) return;
        
        if (AnimationManager.CurPlaying === undefined &&
            state === TYVoiceChatState.Listening &&
            this.isPlaying === false) {
            this.stage = 0;
            this.actions[this.stage].time = 0;
            this.actions[this.stage].play();
            AnimationManager.SetWeight(this.actions[this.stage], 1.0);
            this.actions[this.stage].loop = this.isGroup ? LoopOnce : LoopRepeat;
            this.actions[this.stage].clampWhenFinished = this.isGroup ? true : false;
            if (AnimationManager.LastAction !== undefined) {
                AnimationManager.PrepareCrossFade(AnimationManager.LastAction, this.actions[this.stage], this.blendingTime);
            }
            this.isPlaying = true;
        }

        if (this.isGroup) {
            if (AnimationManager.CurPlaying === TYVoiceChatState.Listening &&
                state === TYVoiceChatState.Listening &&
                this.isPlaying === true &&
                this.stage === 0) {
                if (this.actions[this.stage].time >
                    this.actions[this.stage].getClip().duration - this.blendingTime) {
                    this.actions[this.stage + 1].time = 0;
                    AnimationManager.SetWeight(this.actions[this.stage + 1], 1.0);
                    this.actions[this.stage + 1].loop = LoopRepeat;
                    this.actions[this.stage + 1].play();
                    AnimationManager.PrepareCrossFade(this.actions[this.stage], this.actions[this.stage + 1], this.blendingTime);
                    this.stage = 1;
                }
            }

            if (AnimationManager.CurPlaying === TYVoiceChatState.Listening &&
                state !== TYVoiceChatState.Listening &&
                this.isPlaying === true &&
                (this.stage === 0 || this.stage === 1)) {
                this.actions[2].time = 0;
                this.actions[2].play();
                AnimationManager.SetWeight(this.actions[2], 1.0);
                this.actions[2].loop = LoopOnce;
                AnimationManager.PrepareCrossFade(this.actions[this.stage], this.actions[2], this.blendingTime);
                this.stage = 2;
            }
        }

        if (AnimationManager.CurPlaying === TYVoiceChatState.Listening &&
            state !== TYVoiceChatState.Listening &&
            this.isPlaying === true &&
            this.stage === (this.isGroup ? this.actions.length - 1 : 0)) {
            this.actions[this.stage].loop = LoopOnce;
            this.actions[this.stage].clampWhenFinished = true;
            this.isPlaying = false;
            AnimationManager.LastAction = this.actions[this.stage];
        }
    }
}

/**
 * Think state - thinking animation
 */
class Think extends State {
    constructor(actions, isGroup) {
        super(actions, isGroup);
    }

    update(state) {
        // Safety check: return early if no actions available
        if (!this.actions || this.actions.length === 0) return;
        
        if (AnimationManager.CurPlaying === undefined &&
            state === TYVoiceChatState.Thinking &&
            this.isPlaying === false) {
            this.stage = 0;
            this.actions[this.stage].time = 0;
            this.actions[this.stage].play();
            AnimationManager.SetWeight(this.actions[this.stage], 1.0);
            this.actions[this.stage].loop = LoopOnce;
            if (AnimationManager.LastAction !== undefined) {
                AnimationManager.PrepareCrossFade(AnimationManager.LastAction, this.actions[this.stage], this.blendingTime);
            }
            this.isPlaying = true;
        }

        if (this.isGroup) {
            if (AnimationManager.CurPlaying === TYVoiceChatState.Thinking &&
                state === TYVoiceChatState.Thinking &&
                this.isPlaying === true &&
                this.stage === 0) {
                if (this.actions[this.stage].time >
                    this.actions[this.stage].getClip().duration - this.blendingTime) {
                    this.actions[this.stage + 1].time = 0;
                    AnimationManager.SetWeight(this.actions[this.stage + 1], 1.0);
                    this.actions[this.stage + 1].loop = LoopRepeat;
                    this.actions[this.stage + 1].play();
                    AnimationManager.PrepareCrossFade(this.actions[this.stage], this.actions[this.stage + 1], this.blendingTime);
                    this.stage = 1;
                }
            }

            if (AnimationManager.CurPlaying === TYVoiceChatState.Thinking &&
                state !== TYVoiceChatState.Thinking &&
                this.isPlaying === true &&
                (this.stage === 0 || this.stage === 1)) {
                this.actions[2].time = 0;
                this.actions[2].play();
                AnimationManager.SetWeight(this.actions[2], 1.0);
                this.actions[2].loop = LoopOnce;
                AnimationManager.PrepareCrossFade(this.actions[this.stage], this.actions[2], this.blendingTime);
                this.stage = 2;
            }
        }

        if (AnimationManager.CurPlaying === TYVoiceChatState.Thinking &&
            state !== TYVoiceChatState.Thinking &&
            this.isPlaying === true &&
            this.stage === (this.isGroup ? this.actions.length - 1 : 0)) {
            this.actions[this.stage].loop = LoopOnce;
            this.actions[this.stage].clampWhenFinished = true;
            this.isPlaying = false;
            AnimationManager.LastAction = this.actions[this.stage];
        }
    }
}

/**
 * Speak state - speaking animation with random movement selection
 */
class Speak extends State {
    constructor(actions, isGroup) {
        super(actions, isGroup);
        logger.debug('[SPEAK] Initialized with', actions?.length || 0, 'actions, isGroup:', isGroup);
    }

    /**
     * Get a random number in range [min, max]
     */
    getRandomNumber(max, min) {
        const range = max - min;
        return min + Math.round(Math.random() * range);
    }

    update(state) {
        // Safety check: return early if no actions available
        if (!this.actions || this.actions.length === 0) {
            if (!this._warnedNoActions) {
                logger.warn('[SPEAK] No actions available!');
                this._warnedNoActions = true;
            }
            return;
        }
        
        // Start speaking - pick a random animation
        if (AnimationManager.CurPlaying === undefined &&
            state === TYVoiceChatState.Responding &&
            this.isPlaying === false) {
            // Randomly select initial animation
            this.stage = Math.ceil(this.getRandomNumber(0, this.actions.length - 1));
            logger.debug('[SPEAK] Starting animation, stage:', this.stage, 'of', this.actions.length);
            this.actions[this.stage].time = 0;
            this.actions[this.stage].play();
            AnimationManager.SetWeight(this.actions[this.stage], 1.0);
            this.actions[this.stage].loop = LoopOnce;
            this.actions[this.stage].clampWhenFinished = true;
            if (AnimationManager.LastAction !== undefined) {
                AnimationManager.PrepareCrossFade(AnimationManager.LastAction, this.actions[this.stage], this.blendingTime);
            }
            this.isPlaying = true;
        }

        // Continue speaking - cycle through random animations
        if (AnimationManager.CurPlaying === TYVoiceChatState.Responding &&
            state === TYVoiceChatState.Responding &&
            this.isPlaying === true) {
            if (this.actions[this.stage].time >=
                this.actions[this.stage].getClip().duration - this.blendingTime) {
                const lastAction = this.actions[this.stage];
                // Pick a different random animation
                this.stage = (this.stage + Math.ceil(this.getRandomNumber(1, this.actions.length - 1))) % this.actions.length;
                logger.debug('[SPEAK] Cycling to next animation, stage:', this.stage);
                this.actions[this.stage].time = 0;
                this.actions[this.stage].play();
                AnimationManager.SetWeight(this.actions[this.stage], 1.0);
                this.actions[this.stage].loop = LoopOnce;
                this.actions[this.stage].clampWhenFinished = true;
                AnimationManager.PrepareCrossFade(lastAction, this.actions[this.stage], this.blendingTime);
            }
        }

        // Stop speaking - finish current animation
        if (AnimationManager.CurPlaying === TYVoiceChatState.Responding &&
            state !== TYVoiceChatState.Responding &&
            this.isPlaying === true) {
            this.actions[this.stage].loop = LoopOnce;
            this.actions[this.stage].clampWhenFinished = true;
            this.isPlaying = false;
            AnimationManager.LastAction = this.actions[this.stage];
        }
    }
}

/**
 * AnimationManager - Main animation controller
 * Manages state machine with crossfade transitions between animation states
 */
export class AnimationManager {
    // Static properties
    static IsBlending = false;
    static actions = [];
    static NeedReset = false;
    static NeedFullReset = false;
    static LastAction = undefined;
    static CurPlaying = undefined;

    /**
     * Set animation action weight
     */
    static SetWeight(action, weight) {
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(weight);
    }

    /**
     * Prepare crossfade between two actions
     */
    static PrepareCrossFade(startAction, endAction, defaultDuration) {
        const duration = defaultDuration;
        AnimationManager.UnPauseAllActions();
        AnimationManager.ExecuteCrossFade(startAction, endAction, duration);
        AnimationManager.IsBlending = true;
        setTimeout(() => {
            AnimationManager.IsBlending = false;
        }, defaultDuration + 0.1);
    }

    /**
     * Pause all animation actions
     */
    static PauseAllActions() {
        AnimationManager.actions.forEach(function(action) {
            action.paused = true;
        });
    }

    /**
     * Unpause all animation actions
     */
    static UnPauseAllActions() {
        AnimationManager.actions.forEach(function(action) {
            action.paused = false;
        });
    }

    /**
     * Execute crossfade between two actions
     */
    static ExecuteCrossFade(startAction, endAction, duration) {
        AnimationManager.SetWeight(endAction, 1);
        endAction.time = 0;
        startAction.crossFadeTo(endAction, duration, true);
    }

    /**
     * Constructor
     * @param {THREE.AnimationMixer} mixer - Three.js animation mixer
     * @param {THREE.AnimationClip[]} animations - Animation clips
     * @param {object} animationcfg - Animation configuration
     */
    constructor(mixer, animations, animationcfg) {
        const helloActions = [];
        const idleActions = [];
        const listenActions = [];
        const speakActions = [];
        const thinkActions = [];

        this.mixer = mixer;

        // Calculate action indices based on config
        const helloIdx = animationcfg?.hello?.size || 0;
        const idleIdx = (animationcfg?.idle?.size || 0) + helloIdx;
        const listenIdx = (animationcfg?.listen?.size || 0) + idleIdx;
        const speakIdx = (animationcfg?.speak?.size || 0) + listenIdx;
        const thinkIdx = (animationcfg?.think?.size || 0) + speakIdx;

        // Distribute animation clips to state action arrays
        if (animations && animations.length > 0) {
            for (let i = 0; i < animations.length; i++) {
                const clip = animations[i];
                const action = mixer.clipAction(clip);

                if (i < helloIdx) {
                    helloActions.push(action);
                } else if (i < idleIdx) {
                    idleActions.push(action);
                    // Duplicate for states that share idle
                    if (listenIdx === idleIdx) {
                        listenActions.push(mixer.clipAction(clip.clone()));
                    }
                    if (speakIdx === listenIdx) {
                        speakActions.push(mixer.clipAction(clip.clone()));
                    }
                    if (thinkIdx === speakIdx) {
                        thinkActions.push(mixer.clipAction(clip.clone()));
                    }
                } else if (i < listenIdx) {
                    listenActions.push(action);
                } else if (i < speakIdx) {
                    speakActions.push(action);
                } else if (i < thinkIdx) {
                    thinkActions.push(action);
                }

                AnimationManager.actions.push(action);
                AnimationManager.SetWeight(action, 0);
            }
        }

        // Create state instances
        this.hello = new Hello(helloActions, animationcfg?.hello?.isGroup || false);
        this.idle = new Idle(idleActions, animationcfg?.idle?.isGroup || false);
        this.listen = new Listen(listenActions, animationcfg?.listen?.isGroup || false);
        this.think = new Think(thinkActions, animationcfg?.think?.isGroup || false);
        this.speak = new Speak(speakActions, animationcfg?.speak?.isGroup || false);
    }

    /**
     * Get currently playing state
     */
    curPlaying() {
        if (this.hello.isPlaying) return TYVoiceChatState.Idle;
        if (this.idle.isPlaying) return TYVoiceChatState.Idle;
        if (this.listen.isPlaying) return TYVoiceChatState.Listening;
        if (this.think.isPlaying) return TYVoiceChatState.Thinking;
        if (this.speak.isPlaying) return TYVoiceChatState.Responding;
        return undefined;
    }

    /**
     * Dispose animation manager
     */
    dispose() {
        this.hello.dispose();
        this.idle.dispose();
        this.listen.dispose();
        this.think.dispose();
        this.speak.dispose();
        AnimationManager.actions = [];
    }

    /**
     * Reset all animation actions
     */
    resetAllActions(ignoreBlending = false) {
        const curPlaying = this.curPlaying();
        
        switch (curPlaying) {
            case TYVoiceChatState.Idle:
                AnimationManager.LastAction = this.hello.actions[this.hello.stage];
                break;
            case TYVoiceChatState.Listening:
                AnimationManager.LastAction = this.listen.actions[this.listen.stage];
                break;
            case TYVoiceChatState.Thinking:
                AnimationManager.LastAction = this.think.actions[this.think.stage];
                break;
            case TYVoiceChatState.Responding:
                AnimationManager.LastAction = this.speak.actions[this.speak.stage];
                break;
            default:
                AnimationManager.LastAction = undefined;
                break;
        }

        if (AnimationManager.LastAction) {
            AnimationManager.LastAction.loop = LoopOnce;
            AnimationManager.LastAction.clampWhenFinished = true;
            AnimationManager.SetWeight(AnimationManager.LastAction, 1.0);
        }

        if (ignoreBlending) {
            AnimationManager.PauseAllActions();
            AnimationManager.actions.forEach(function(action) {
                action.time = 0;
                AnimationManager.SetWeight(action, 0.0);
            });
            AnimationManager.LastAction = undefined;
        }

        this.hello.isPlaying = false;
        this.idle.isPlaying = false;
        this.listen.isPlaying = false;
        this.think.isPlaying = false;
        this.speak.isPlaying = false;
    }

    /**
     * Update animation state
     * @param {string} state - Target state (TYVoiceChatState)
     */
    update(state) {
        if (AnimationManager.IsBlending) return;

        AnimationManager.CurPlaying = this.curPlaying();

        if (AnimationManager.CurPlaying === undefined) {
            switch (state) {
                case TYVoiceChatState.Idle:
                    this.idle.update(state);
                    break;
                case TYVoiceChatState.Listening:
                    this.listen.update(state);
                    break;
                case TYVoiceChatState.Thinking:
                    this.think.update(state);
                    break;
                case TYVoiceChatState.Responding:
                    this.speak.update(state);
                    break;
                default:
                    this.idle.update(state);
                    break;
            }
        } else {
            switch (AnimationManager.CurPlaying) {
                case TYVoiceChatState.Idle:
                    this.idle.update(state);
                    break;
                case TYVoiceChatState.Listening:
                    this.listen.update(state);
                    break;
                case TYVoiceChatState.Thinking:
                    this.think.update(state);
                    break;
                case TYVoiceChatState.Responding:
                    this.speak.update(state);
                    break;
                default:
                    this.idle.update(state);
                    break;
            }
        }
    }
}

export { State, Hello, Idle, Listen, Think, Speak };
export default AnimationManager;
