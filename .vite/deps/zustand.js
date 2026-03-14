import { r as __toESM } from "./chunk-BoAXSpZd.js";
import { t as require_react } from "./react.js";
import { t as createStore } from "./vanilla-CsLEz01K.js";
//#region node_modules/.pnpm/zustand@5.0.11_@types+react@19.2.14_react@19.2.4_use-sync-external-store@1.6.0_react@19.2.4_/node_modules/zustand/esm/react.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var identity = (arg) => arg;
function useStore(api, selector = identity) {
	const slice = import_react.useSyncExternalStore(api.subscribe, import_react.useCallback(() => selector(api.getState()), [api, selector]), import_react.useCallback(() => selector(api.getInitialState()), [api, selector]));
	import_react.useDebugValue(slice);
	return slice;
}
var createImpl = (createState) => {
	const api = createStore(createState);
	const useBoundStore = (selector) => useStore(api, selector);
	Object.assign(useBoundStore, api);
	return useBoundStore;
};
var create = ((createState) => createState ? createImpl(createState) : createImpl);
//#endregion
export { create, createStore, useStore };

//# sourceMappingURL=zustand.js.map