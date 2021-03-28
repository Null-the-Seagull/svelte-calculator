
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.35.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.35.0 */

    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let hr;
    	let t2;
    	let input;
    	let br;
    	let t3;
    	let table;
    	let tr0;
    	let td0;
    	let button0;
    	let t5;
    	let td1;
    	let button1;
    	let t7;
    	let td2;
    	let button2;
    	let t9;
    	let tr1;
    	let td3;
    	let button3;
    	let t11;
    	let td4;
    	let button4;
    	let t13;
    	let td5;
    	let button5;
    	let t15;
    	let tr2;
    	let td6;
    	let button6;
    	let t17;
    	let td7;
    	let button7;
    	let t19;
    	let td8;
    	let button8;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = `${/*title*/ ctx[1]}`;
    			t1 = space();
    			hr = element("hr");
    			t2 = space();
    			input = element("input");
    			br = element("br");
    			t3 = space();
    			table = element("table");
    			tr0 = element("tr");
    			td0 = element("td");
    			button0 = element("button");
    			button0.textContent = "7";
    			t5 = space();
    			td1 = element("td");
    			button1 = element("button");
    			button1.textContent = "8";
    			t7 = space();
    			td2 = element("td");
    			button2 = element("button");
    			button2.textContent = "9";
    			t9 = space();
    			tr1 = element("tr");
    			td3 = element("td");
    			button3 = element("button");
    			button3.textContent = "4";
    			t11 = space();
    			td4 = element("td");
    			button4 = element("button");
    			button4.textContent = "5";
    			t13 = space();
    			td5 = element("td");
    			button5 = element("button");
    			button5.textContent = "6";
    			t15 = space();
    			tr2 = element("tr");
    			td6 = element("td");
    			button6 = element("button");
    			button6.textContent = "1";
    			t17 = space();
    			td7 = element("td");
    			button7 = element("button");
    			button7.textContent = "2";
    			t19 = space();
    			td8 = element("td");
    			button8 = element("button");
    			button8.textContent = "3";
    			attr_dev(h1, "class", "svelte-15qukjs");
    			add_location(h1, file, 11, 1, 158);
    			add_location(hr, file, 12, 1, 177);
    			attr_dev(input, "id", "inp_display");
    			attr_dev(input, "type", "text");
    			input.value = /*result_display*/ ctx[0];
    			input.readOnly = true;
    			add_location(input, file, 13, 1, 184);
    			add_location(br, file, 13, 69, 252);
    			button0.value = "7";
    			attr_dev(button0, "class", "svelte-15qukjs");
    			add_location(button0, file, 17, 4, 289);
    			add_location(td0, file, 16, 3, 279);
    			button1.value = "8";
    			attr_dev(button1, "class", "svelte-15qukjs");
    			add_location(button1, file, 20, 4, 366);
    			add_location(td1, file, 19, 3, 356);
    			button2.value = "9";
    			attr_dev(button2, "class", "svelte-15qukjs");
    			add_location(button2, file, 23, 4, 442);
    			add_location(td2, file, 22, 3, 432);
    			add_location(tr0, file, 15, 2, 270);
    			button3.value = "4";
    			attr_dev(button3, "class", "svelte-15qukjs");
    			add_location(button3, file, 28, 4, 535);
    			add_location(td3, file, 27, 3, 525);
    			button4.value = "5";
    			attr_dev(button4, "class", "svelte-15qukjs");
    			add_location(button4, file, 31, 4, 612);
    			add_location(td4, file, 30, 3, 602);
    			button5.value = "6";
    			attr_dev(button5, "class", "svelte-15qukjs");
    			add_location(button5, file, 34, 4, 691);
    			add_location(td5, file, 33, 3, 681);
    			add_location(tr1, file, 26, 2, 516);
    			button6.value = "1";
    			attr_dev(button6, "class", "svelte-15qukjs");
    			add_location(button6, file, 39, 4, 787);
    			add_location(td6, file, 38, 3, 777);
    			button7.value = "2";
    			attr_dev(button7, "class", "svelte-15qukjs");
    			add_location(button7, file, 42, 4, 864);
    			add_location(td7, file, 41, 3, 854);
    			button8.value = "3";
    			attr_dev(button8, "class", "svelte-15qukjs");
    			add_location(button8, file, 45, 4, 940);
    			add_location(td8, file, 44, 3, 930);
    			add_location(tr2, file, 37, 2, 768);
    			add_location(table, file, 14, 1, 259);
    			attr_dev(main, "class", "svelte-15qukjs");
    			add_location(main, file, 10, 0, 149);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, hr);
    			append_dev(main, t2);
    			append_dev(main, input);
    			append_dev(main, br);
    			append_dev(main, t3);
    			append_dev(main, table);
    			append_dev(table, tr0);
    			append_dev(tr0, td0);
    			append_dev(td0, button0);
    			append_dev(tr0, t5);
    			append_dev(tr0, td1);
    			append_dev(td1, button1);
    			append_dev(tr0, t7);
    			append_dev(tr0, td2);
    			append_dev(td2, button2);
    			append_dev(table, t9);
    			append_dev(table, tr1);
    			append_dev(tr1, td3);
    			append_dev(td3, button3);
    			append_dev(tr1, t11);
    			append_dev(tr1, td4);
    			append_dev(td4, button4);
    			append_dev(tr1, t13);
    			append_dev(tr1, td5);
    			append_dev(td5, button5);
    			append_dev(table, t15);
    			append_dev(table, tr2);
    			append_dev(tr2, td6);
    			append_dev(td6, button6);
    			append_dev(tr2, t17);
    			append_dev(tr2, td7);
    			append_dev(td7, button7);
    			append_dev(tr2, t19);
    			append_dev(tr2, td8);
    			append_dev(td8, button8);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*handleClick*/ ctx[2], false, false, false),
    					listen_dev(button1, "click", /*handleClick*/ ctx[2], false, false, false),
    					listen_dev(button2, "click", /*handleClick*/ ctx[2], false, false, false),
    					listen_dev(button3, "click", /*handleClick*/ ctx[2], false, false, false),
    					listen_dev(button4, "click", /*handleClick*/ ctx[2], false, false, false),
    					listen_dev(button5, "click", /*handleClick*/ ctx[2], false, false, false),
    					listen_dev(button6, "click", /*handleClick*/ ctx[2], false, false, false),
    					listen_dev(button7, "click", /*handleClick*/ ctx[2], false, false, false),
    					listen_dev(button8, "click", /*handleClick*/ ctx[2], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*result_display*/ 1 && input.value !== /*result_display*/ ctx[0]) {
    				prop_dev(input, "value", /*result_display*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let title = "Svelte Calculator";
    	let result_display;

    	function handleClick(e) {
    		$$invalidate(0, result_display = e.target.value);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ title, result_display, handleClick });

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("result_display" in $$props) $$invalidate(0, result_display = $$props.result_display);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [result_display, title, handleClick];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'pepega'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
