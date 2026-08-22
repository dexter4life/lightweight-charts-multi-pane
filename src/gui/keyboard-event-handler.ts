import { IDestroyable } from "../helpers/idestroyable";

export type HandlerKeyboardEventCallback = (event: KeyboardEventHandlerEvent) => void;

/** Optional keyboard event callbacks implemented by the handler target. */
export interface KeyboardEventHandlers {
	/** `keydown` listener. */
	keyDownEvent?: HandlerKeyboardEventCallback;

	/** `keyup` listener. */
	keyUpEvent?: HandlerKeyboardEventCallback;

	/** `keypress` listener. */
	keyPressEvent?: HandlerKeyboardEventCallback;
}

/** Normalized keyboard event delivered to {@link KeyboardEventHandlers} callbacks. */
export interface KeyboardEventHandlerEvent {
	/** Original DOM event type. */
	readonly srcType: string;

	/** {@link KeyboardEvent.key} */
	readonly key: string;

	/** {@link KeyboardEvent.code} */
	readonly code: string;

	/** {@link KeyboardEvent.location} */
	readonly location: number;

	/** {@link KeyboardEvent.repeat} */
	readonly repeat: boolean;

	/** Control key was active. */
	readonly ctrlKey: boolean;

	/** Alt (Option/⌥) key was active. */
	readonly altKey: boolean;

	/** Shift key was active. */
	readonly shiftKey: boolean;

	/** Meta (⌘/⊞) key was active. */
	readonly metaKey: boolean;

	/** Original event target. */
	target: KeyboardEvent["target"];

	/** Window view associated with the event. */
	view: KeyboardEvent["view"];

	/** Prevent the default action of the underlying DOM event if cancelable. */
	preventDefault(): void;
}

/** Options for {@link KeyboardEventHandler}. */
export interface KeyboardEventHandlerOptions {
	/** Return `true` to prevent the default action of the underlying DOM event. */
	preventDefault?: (event: KeyboardEventHandlerEvent) => boolean;
}

/**
 * Subscribes to `keydown`/`keyup`/`keypress` on a target element and dispatches
 * normalized {@link KeyboardEventHandlerEvent}s to a {@link KeyboardEventHandlers}
 * implementation. The target must be focusable (e.g. `tabindex="0"`).
 */
export class KeyboardEventHandler implements IDestroyable {
	private readonly _target: HTMLElement;
	private readonly _handler: KeyboardEventHandlers;
	private readonly _options: KeyboardEventHandlerOptions;

	private _unsubscribeKeyDown: (() => void) | null = null;
	private _unsubscribeKeyUp: (() => void) | null = null;
	private _unsubscribeKeyPress: (() => void) | null = null;

	public constructor(
		target: HTMLElement,
		handler: KeyboardEventHandlers,
		options?: KeyboardEventHandlerOptions,
	) {
		this._target = target;
		this._handler = handler;
		this._options = options ?? {};

		this._init();
	}

	public destroy(): void {
		if (this._unsubscribeKeyDown !== null) {
			this._unsubscribeKeyDown();
			this._unsubscribeKeyDown = null;
		}

		if (this._unsubscribeKeyUp !== null) {
			this._unsubscribeKeyUp();
			this._unsubscribeKeyUp = null;
		}

		if (this._unsubscribeKeyPress !== null) {
			this._unsubscribeKeyPress();
			this._unsubscribeKeyPress = null;
		}
	}

	private _init(): void {
		const boundKeyDownHandler = this._keyDownHandler.bind(this);
		const boundKeyUpHandler = this._keyUpHandler.bind(this);
		const boundKeyPressHandler = this._keyPressHandler.bind(this);

		this._target.addEventListener("keydown", boundKeyDownHandler);
		this._unsubscribeKeyDown = () => {
			this._target.removeEventListener("keydown", boundKeyDownHandler);
		};

		this._target.addEventListener("keyup", boundKeyUpHandler);
		this._unsubscribeKeyUp = () => {
			this._target.removeEventListener("keyup", boundKeyUpHandler);
		};

		this._target.addEventListener("keypress", boundKeyPressHandler);
		this._unsubscribeKeyPress = () => {
			this._target.removeEventListener("keypress", boundKeyPressHandler);
		};
	}

	private _keyDownHandler(event: KeyboardEvent): void {
		const compatEvent = this._makeCompatEvent(event);
		this._maybePreventDefault(event, compatEvent);
		this._processKeyboardEvent(compatEvent, this._handler.keyDownEvent);
	}

	private _keyUpHandler(event: KeyboardEvent): void {
		const compatEvent = this._makeCompatEvent(event);
		this._maybePreventDefault(event, compatEvent);
		this._processKeyboardEvent(compatEvent, this._handler.keyUpEvent);
	}

	private _keyPressHandler(event: KeyboardEvent): void {
		const compatEvent = this._makeCompatEvent(event);
		this._maybePreventDefault(event, compatEvent);
		this._processKeyboardEvent(compatEvent, this._handler.keyPressEvent);
	}

	private _processKeyboardEvent(
		event: KeyboardEventHandlerEvent,
		callback?: HandlerKeyboardEventCallback,
	): void {
		if (!callback) {
			return;
		}

		callback.call(this._handler, event);
	}

	private _maybePreventDefault(
		domEvent: KeyboardEvent,
		compatEvent: KeyboardEventHandlerEvent,
	): void {
		if (
			this._options.preventDefault !== undefined &&
			this._options.preventDefault(compatEvent)
		) {
			preventDefault(domEvent);
		}
	}

	private _makeCompatEvent(event: KeyboardEvent): KeyboardEventHandlerEvent {
		return {
			srcType: event.type,
			key: event.key,
			code: event.code,
			location: event.location,
			repeat: event.repeat,

			ctrlKey: event.ctrlKey,
			altKey: event.altKey,
			shiftKey: event.shiftKey,
			metaKey: event.metaKey,

			target: event.target,
			view: event.view,

			preventDefault: () => {
				preventDefault(event);
			},
		};
	}
}

function preventDefault(event: Event): void {
	if (event.cancelable) {
		event.preventDefault();
	}
}
