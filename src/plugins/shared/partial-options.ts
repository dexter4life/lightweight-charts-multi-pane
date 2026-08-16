/** Recursively makes all properties in T optional (simpler than the library-wide DeepPartial
 *  because it doesn't try to partially-unwrap array element types). */
export type PartialOptions<T> = {
	[P in keyof T]?: T[P] extends object ? PartialOptions<T[P]> : T[P];
};