import { TimePointIndex } from "../model/time-data";

type Point = { time: TimePointIndex | null; price: number | null };

export class PixelPoints {
	private _points: Point[] = [];
	private _lastTime = 0;
	private _animating = false;
	private speed = 0.0001;
	private cleanup: (instance: PixelPoints) => void;
	private requestUpdate: () => void;
	opacity: number = 0.5;
	public erased: boolean = false;
	private _id: number;

	constructor(requestUpdate: () => void, cleanup: (instance: PixelPoints) => void) {
		this.cleanup = cleanup;
		this.requestUpdate = requestUpdate;
		this._id = Math.random();
	}

	getId() {
		return this._id;
	}

	setPoints(time: TimePointIndex | null, price: number | null) {
		this._points.push({ time, price });
	}

	points() {
		return this._points ?? [];
	}

	animate(timestamp: DOMHighResTimeStamp) {
		if (!this._lastTime) {
			this._lastTime = timestamp;
		}

		const deltaTime = timestamp - this._lastTime;
		this._lastTime = timestamp;

		this.opacity -= this.speed * deltaTime;

		if (this.opacity > 0) {
			this.requestUpdate();
			requestAnimationFrame(this.animate.bind(this));
		} else {
			this.opacity = 0;
			this._animating = false;
			this.erased = true;
			this.cleanup(this);
		}
	}

	isAnimating() {
		return this._animating;
	}

	clear() {
		if (!this._animating) {
			this._animating = true;
			window.requestAnimationFrame(this.animate.bind(this));
		}
	}
}
