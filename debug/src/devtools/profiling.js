import { ElementTypeClass, ElementTypeFunction, ElementTypeMemo, ElementTypeForwardRef } from './constants';
import { getNearestDisplayName, getVNodeType } from './vnode';
import { getVNode } from './cache';
import { now } from './util';

/**
 * Start a profiling session
 * @param {import('../internal').DevtoolsHook} hook
 * @param {import('../internal').AdapterState} state
 * @param {number} rendererId
 */
export function startProfiling(hook, state, rendererId) {
	if (state.isProfiling) return;

	state.isProfiling = true;
	state.profilingStart = now();
}

/**
 * @param {import('../internal').AdapterState} state
 */
export function stopProfiling(state) {
	state.isProfiling = false;
}

/**
 * @param {number} rendererId
 * @param {import('../internal').AdapterState} state
 * @returns {import('../internal').ProfilingData}
 */
export function getProfilingData(state, rendererId) {

	/** @type {Array<import('../internal').ProfilingRootDataBackend>} */
	let data = [];

	// Loop over the profiling data for each root
	state.profilingData.forEach((profile, rootId) => {

		/** @type {Array<import('../internal').CommitDataBackend>} */
		let commitData = [];

		let fiberActualDurations = [];
		let fiberSelfDurations = [];
		let initialDurations = [];

		state.vnodeDurations.forEach((value, id) => {
			initialDurations.push([id, value]);
		});

		profile.forEach(durations => {
			let maxActualDuration = 0;

			for (let i = 0; i < durations.length; i+=3) {
				let id = durations[i];
				fiberActualDurations.push([id, durations[i+1]]);
				fiberSelfDurations.push([id, durations[i+2]]);

				if (durations[i+1] > maxActualDuration) {
					maxActualDuration = durations[i+1];
				}
			}

			// render reasons
			let changeDescriptions = [];
			state.changeDescriptions.forEach((change, id) => {
				changeDescriptions.push([id, change]);
			});

			commitData.push({
				changeDescriptions,
				duration: maxActualDuration,
				fiberActualDurations,
				fiberSelfDurations,
				interactionIDs: [],
				priorityLevel: null,
				timestamp: performance.now() - state.profilingStart
			});
		});

		data.push({
			commitData,
			displayName: getNearestDisplayName(getVNode(rootId)),
			initialTreeBaseDurations: initialDurations,
			interactionCommits: [],
			interactions: [],
			rootID: rootId
		});
	});

	return {
		rendererID: rendererId,
		dataForRoots: data
	};
}

/**
 * Get the reasons why a component rendered
 * @param {import('../internal').VNode} vnode
 * @returns {import('../internal').ChangeDescription | null}
 */
export function getChangeDescription(vnode) {
	let type = getVNodeType(vnode);

	switch (type) {
		case ElementTypeClass:
		case ElementTypeFunction:
		case ElementTypeMemo:
		case ElementTypeForwardRef: {
			let isNew = false;
			if (isNew) {
				return {
					context: null,
					didHooksChange: false,
					isFirstMount: true,
					props: null,
					state: null
				};
			}

			let c = vnode._component;
			return {
				context: getChangedKeys(c._context, c._prevContext)!=null,
				didHooksChange: c._prevHooksRevision!=c._currentHooksRevision,
				isFirstMount: false,
				props: getChangedKeys(c.props, c._prevProps),
				state: getChangedKeys(c.state, c._prevState)
			};
		}
		default:
			return null;
	}
}

/**
 * Check if two objecs changed
 * @param {object | null} a
 * @param {object | null} b
 * @returns {string[] | null}
 */
export function getChangedKeys(a, b) {
	if (a==null || b==null) return null;

	let changed = [];
	for (let i in b) if (a[i]!==b[i]) {
		changed.push(i);
	}

	return changed.length > 0 ? changed : null;
}