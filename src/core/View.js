/**
 * Render tree node.
 * Copyright Metrological, 2017
 */

let StageUtils = require('./StageUtils');
let ViewCore = require('./core/ViewCore');
let Base = require('./Base');

class View {

    constructor(stage) {
        EventEmitter.call(this);

        this.id = View.id++;

        this.wasmId = 0;

        this.stage = stage;

        this._core = new ViewCore(this);

        /**
         * Lazy-loaded texturization module.
         * @type {ViewTexturizer}
         */
        this._texturizer = null;

        /**
         * A view is active if it is a descendant of the stage root and it is visible (worldAlpha > 0).
         * @type {boolean}
         */
        this._active = false;

        /**
         * A view is active if it is a descendant of the stage root.
         * @type {boolean}
         */
        this._attached = false;

        /**
         * @type {View}
         */
        this._parent = null;

        /**
         * The texture that is currently set.
         * @type {Texture}
         * @protected
         */
        this._texture = null;

        /**
         * The currently displayed texture. While this.texture is loading, this one may be different.
         * @type {Texture}
         * @protected
         */
        this._displayedTexture = null;

        /**
         * Tags that can be used to identify/search for a specific view.
         * @type {String[]}
         */
        this._tags = null;

        /**
         * The tree's tags mapping.
         * This contains all views for all known tags, at all times.
         * @type {Map}
         */
        this._treeTags = null;

        /**
         * Cache for the tag/mtag methods.
         * @type {Map<String,View[]>}
         */
        this._tagsCache = null;

        /**
         * Tag-to-complex cache (all tags that are part of the complex caches).
         * This maps tags to cached complex tags in the cache.
         * @type {Map<String,String[]>}
         */
        this._tagToComplex = null;

        /**
         * Creates a tag context: tagged views in this branch will not be reachable from ancestors of this view.
         * @type {boolean}
         * @private
         */
        this._tagRoot = false;

        this._x = 0;
        this._y = 0;
        this._w = 0;
        this._h = 0;
        this._scaleX = 1;
        this._scaleY = 1;
        this._pivotX = 0.5;
        this._pivotY = 0.5;
        this._mountX = 0;
        this._mountY = 0;
        this._alpha = 1;
        this._rotation = 0;
        this._visible = true;

        /**
         * The text functionality in case this view is a text view.
         * @type {ViewText}
         */
        this._viewText = null;

        /**
         * (Lazy-initialised) list of children owned by this view.
         * @type {ViewChildList}
         */
        this._childList = null;

        /**
         * (Lazy-initialised) exposed (public) list of children for this view.
         * This is normally the same as _childList except for complex views such as Lists.
         * @type {ViewChildList}
         */
        this._exposedChildList = null;

    }

    setAsRoot() {
        this._updateActiveFlag();
        this._updateAttachedFlag();
        this._core.setAsRoot();
    }

    _setParent(parent) {
        if (this._parent === parent) return;

        if (this._parent) {
            this._unsetTagsParent();
        }

        this._parent = parent;

        if (parent) {
            this._setTagsParent();
        }

        this._updateActiveFlag();

        this._updateAttachedFlag();
    };

    getDepth() {
        let depth = 0;

        let p = this;
        do {
            depth++;
            p = p._parent;
        } while (p);

        return depth;
    };

    getAncestor(l) {
        let p = this;
        while (l > 0 && p._parent) {
            p = p._parent;
            l--;
        }
        return p;
    };

    getAncestorAtDepth(depth) {
        let levels = this.getDepth() - depth;
        if (levels < 0) {
            return null;
        }
        return this.getAncestor(levels);
    };

    isAncestorOf(c) {
        let p = c;
        while(p = p.parent) {
            if (this === p) {
                return true;
            }
        }
        return false;
    };

    getSharedAncestor(c) {
        let o1 = this;
        let o2 = c;
        let l1 = o1.getDepth();
        let l2 = o2.getDepth();
        if (l1 > l2) {
            o1 = o1.getAncestor(l1 - l2);
        } else if (l2 > l1) {
            o2 = o2.getAncestor(l2 - l1);
        }

        do {
            if (o1 === o2) {
                return o1;
            }

            o1 = o1._parent;
            o2 = o2._parent;
        } while (o1 && o2);

        return null;
    };

    get active() {
        return this._active
    }

    get attached() {
        return this._attached
    }

    isActive() {
        return this._visible && (this._alpha > 0) && (this._parent ? this._parent._active : (this.stage.root === this));
    };

    isAttached() {
        return (this._parent ? this._parent._attached : (this.stage.root === this));
    };

    /**
     * Updates the 'active' flag for this branch.
     */
    _updateActiveFlag() {
        // Calculate active flag.
        let newActive = this.isActive();
        if (this._active !== newActive) {
            if (newActive) {
                this._setActiveFlag();
            } else {
                this._unsetActiveFlag();
            }

            let children = this._children.get();
            if (children) {
                let m = children.length;
                if (m > 0) {
                    for (let i = 0; i < m; i++) {
                        children[i]._updateActiveFlag();
                    }
                }
            }

            // Run this after all _children because we'd like to see (de)activating a branch as an 'atomic' operation.
            if (this._eventsCount) {
                this.emit('active', newActive);
            }
        }
    };

    _setActiveFlag() {
        // Detect texture changes.
        let dt = null;
        if (this._texture && this._texture.source.glTexture) {
            dt = this._texture;
            this._texture.source.addView(this);
        } else if (this._displayedTexture && this._displayedTexture.source.glTexture) {
            dt = this._displayedTexture;
        }

        this.displayedTexture = dt;

        // Force re-check of texture because dimensions might have changed (cutting).
        this._updateDimensions();
        this._updateTextureCoords();

        this._active = true;

        if (this._texture) {
            // It is important to add the source listener before the texture listener because that may trigger a load.
            this._texture.source.addView(this);
        }

        if (this._displayedTexture && this._displayedTexture !== this._texture) {
            this._displayedTexture.source.addView(this);
        }
    }

    _unsetActiveFlag() {
        if (this._texture) {
            this._texture.source.removeView(this);
        }

        if (this._displayedTexture) {
            this._displayedTexture.source.removeView(this);
        }

        if (this._texturizer) {
            this._texturizer.deactivate();
        }

        this._active = false;
    }

    /**
     * Updates the 'attached' flag for this branch.
     */
    _updateAttachedFlag() {
        let newAttached = this.isAttached();
        if (this._attached !== newAttached) {
            this._attached = newAttached;

            this._updateAttachedFlagChildren();

            if (newAttached) {
                this.stage.wasmJs.attachBranch(this);
            } else {
                this.stage.wasmJs.detachBranch(this);
            }
        }
    }

    /**
     * Updates the 'attached' flag for this branch.
     */
    _updateAttachedFlagChildren() {
        let children = this._children.get();
        if (children) {
            let m = children.length;
            if (m > 0) {
                for (let i = 0; i < m; i++) {
                    children[i]._updateAttachedFlagRecursive();
                }
            }
        }
    };

    /**
     * Updates the 'attached' flag for this branch.
     */
    _updateAttachedFlagRecursive() {
        // Calculate active flag.
        let newAttached = this.isAttached();
        if (this._attached !== newAttached) {
            this._attached = newAttached;

            let children = this._children.get();
            if (children) {
                let m = children.length;
                if (m > 0) {
                    for (let i = 0; i < m; i++) {
                        children[i]._updateAttachedFlagRecursive();
                    }
                }
            }
        }
    };

    _getRenderWidth() {
        if (this._w) {
            return this._w;
        } else if (this._texture && this._texture.source.glTexture) {
            // Texture already loaded, but not yet updated (probably because it's not active).
            return (this._texture.w || (this._texture.source.w / this._texture.precision));
        } else if (this._displayedTexture) {
            return (this._displayedTexture.w || (this._displayedTexture.source.w / this._displayedTexture.precision));
        } else {
            return 0;
        }
    };

    _getRenderHeight() {
        if (this._h) {
            return this._h;
        } else if (this._texture && this._texture.source.glTexture) {
            // Texture already loaded, but not yet updated (probably because it's not active).
            return (this._texture.h || this._texture.source.h) / this._texture.precision;
        } else if (this._displayedTexture) {
            return (this._displayedTexture.h || this._displayedTexture.source.h) / this._displayedTexture.precision;
        } else {
            return 0;
        }
    };

    get renderWidth() {
        if (this._active) {
            // Render width is only maintained if this view is active.
            return this._core._rw;
        } else {
            return this._getRenderWidth();
        }
    }

    get renderHeight() {
        if (this._active) {
            return this._core._rh;
        } else {
            return this._getRenderHeight();
        }
    }

    get texture() {
        return this._texture;
    }

    textureIsLoaded() {
        return this.texture ? !!this.texture.source.glTexture : false;
    }

    loadTexture(sync) {
        if (this.texture) {
            this.texture.source.load(sync);
        }
    }

    set texture(v) {
        if (v && Utils.isObjectLiteral(v)) {
            if (this.texture) {
                Base.setObjectSettings(this.texture, v);
            } else {
                console.warn('Trying to set texture properties, but there is no texture.');
            }
            return;
        }

        let prevValue = this._texture;
        if (v !== prevValue) {
            if (v !== null) {
                if (v instanceof TextureSource) {
                    v = this.stage.texture(v);
                } else if (!(v instanceof Texture)) {
                    console.error('incorrect value for texture');
                    return;
                }
            }

            this._texture = v;

            if (this._active && prevValue && this.displayedTexture !== prevValue) {
                // Keep reference to view for texture source
                if ((!v || prevValue.source !== v.source) && (!this.displayedTexture || (this.displayedTexture.source !== prevValue.source))) {
                    prevValue.source.removeView(this);
                }
            }

            if (v) {
                if (this._active) {
                    // When the texture is changed, maintain the texture's sprite registry.
                    // While the displayed texture is different from the texture (not yet loaded), two textures are referenced.
                    v.source.addView(this);
                }

                if (v.source.glTexture) {
                    this.displayedTexture = v;
                }
            } else {
                // Make sure that current texture is cleared when the texture is explicitly set to null.
                this.displayedTexture = null;
            }
        }
    }

    get displayedTexture() {
        return this._displayedTexture;
    }

    set displayedTexture(v) {
        let prevValue = this._displayedTexture;
        if (v !== prevValue) {
            if (this._active && prevValue) {
                // We can assume that this._texture === this._displayedTexture.

                if (prevValue !== this._texture) {
                    // The old displayed texture is deprecated.
                    if (!v || (prevValue.source !== v.source)) {
                        prevValue.source.removeView(this);
                    }
                }
            }

            this._displayedTexture = v;

            this._updateDimensions();

            if (v) {
                if (this._eventsCount) {
                    this.emit('txLoaded', v);
                }

                // We don't need to reference the displayed texture because it was already referenced (this.texture === this.displayedTexture).
                this._updateTextureCoords();
                this._core.setDisplayedTextureSource(v.source);
            } else {
                if (this._eventsCount) {
                    this.emit('txUnloaded', v);
                }

                this._core.setDisplayedTextureSource(null);
            }
        }
    }

    onTextureSourceLoaded() {
        // Now we can start showing this texture.
        this.displayedTexture = this._texture;
    };

    onTextureSourceLoadError(e) {
        if (this._eventsCount) {
            this.emit('txError', e, this._texture.source);
        }
    };

    onTextureSourceAddedToTextureAtlas() {
        this._updateTextureCoords();
    };

    onTextureSourceRemovedFromTextureAtlas() {
        this._updateTextureCoords();
    };

    onDisplayedTextureClippingChanged() {
        this._updateDimensions();
        this._updateTextureCoords();
    };

    onPrecisionChanged() {
        this._updateDimensions();
    };

    _updateDimensions() {
        let beforeW = this._core.rw;
        let beforeH = this._core.rh;
        let rw = this._getRenderWidth();
        let rh = this._getRenderHeight();
        if (beforeW !== rw || beforeH !== rh) {
            // Due to width/height change: update the translation vector.
            this._core.setDimensions(this._getRenderWidth(), this._getRenderHeight());
            this._updateLocalTranslate();
            return true
        }
        return false
    }

    _updateLocalTransform() {
        if (this._rotation !== 0 && this._rotation % (2 * Math.PI)) {
            // check to see if the rotation is the same as the previous render. This means we only need to use sin and cos when rotation actually changes
            let _sr = Math.sin(this._rotation);
            let _cr = Math.cos(this._rotation);

            this._core.setLocalTransform(
                _cr * this._scaleX,
                -_sr * this._scaleY,
                _sr * this._scaleX,
                _cr * this._scaleY
            );
        } else {
            this._core.setLocalTransform(
                this._scaleX,
                0,
                0,
                this._scaleY
            );
        }
        this._updateLocalTranslate();
    };

    _updateLocalTranslate() {
        let pivotXMul = this._pivotX * this.renderWidth;
        let pivotYMul = this._pivotY * this.renderHeight;
        let px = this._x - (pivotXMul * this._core.localTa + pivotYMul * this._core.localTb) + pivotXMul;
        let py = this._y - (pivotXMul * this._core.localTc + pivotYMul * this._core.localTd) + pivotYMul;
        px -= this._mountX * this.renderWidth;
        py -= this._mountY * this.renderHeight;
        this._core.setLocalTranslate(
            px,
            py
        );
    };

    _updateLocalTranslateDelta(dx, dy) {
        this._core.addLocalTranslate(dx, dy)
    };

    _updateLocalAlpha() {
        this._core.setLocalAlpha(this._getLocalAlpha());
    };

    _getLocalAlpha() {
        return this._visible ? this._alpha : 0
    }

    _updateTextureCoords() {
        if (this.displayedTexture && this.displayedTexture.source) {
            let displayedTexture = this.displayedTexture;
            let displayedTextureSource = this.displayedTexture.source;

            let tx1 = 0, ty1 = 0, tx2 = 1.0, ty2 = 1.0;
            if (displayedTexture.clipping) {
                // Apply texture clipping.
                let w = displayedTextureSource.getRenderWidth();
                let h = displayedTextureSource.getRenderHeight();
                let iw, ih, rw, rh;
                iw = 1 / w;
                ih = 1 / h;

                if (displayedTexture.w) {
                    rw = displayedTexture.w * iw;
                } else {
                    rw = (w - displayedTexture.x) * iw;
                }

                if (displayedTexture.h) {
                    rh = displayedTexture.h * ih;
                } else {
                    rh = (h - displayedTexture.y) * ih;
                }

                iw *= displayedTexture.x;
                ih *= displayedTexture.y;

                tx1 = Math.min(1.0, Math.max(0, iw));
                ty1 = Math.min(1.0, Math.max(ih));
                tx2 = Math.min(1.0, Math.max(tx2 * rw + iw));
                ty2 = Math.min(1.0, Math.max(ty2 * rh + ih));
            }

            let inTextureAtlas = this._core.allowTextureAtlas() && displayedTextureSource.inTextureAtlas
            if (inTextureAtlas) {
                // Calculate texture atlas texture coordinates.
                let textureAtlasI = 0.000488281;    // 1/2048.

                let tax = (displayedTextureSource.textureAtlasX * textureAtlasI);
                let tay = (displayedTextureSource.textureAtlasY * textureAtlasI);
                let dax = (displayedTextureSource.w * textureAtlasI);
                let day = (displayedTextureSource.h * textureAtlasI);

                tx1 = tx1 * dax + tax;
                ty1 = ty1 * dax + tay;

                tx2 = tx2 * dax + tax;
                ty2 = ty2 * day + tay;
            }

            this._core.setTextureCoords(tx1, ty1, tx2, ty2);
            this._core.setInTextureAtlas(inTextureAtlas);
        }
    }

    getCornerPoints() {
        return this._core.getCornerPoints();
    }

    /**
     * Clears the cache(s) for the specified tag.
     * @param {String} tag
     */
    _clearTagsCache(tag) {
        if (this._tagsCache) {
            this._tagsCache.delete(tag);

            if (this._tagToComplex) {
                let s = this._tagToComplex.get(tag);
                if (s) {
                    for (let i = 0, n = s.length; i < n; i++) {
                        this._tagsCache.delete(s[i]);
                    }
                    this._tagToComplex.delete(tag);
                }
            }
        }
    };

    _unsetTagsParent() {
        let tags = null;
        let n = 0;
        if (!this._tagRoot && this._treeTags) {
            tags = Utils.iteratorToArray(this._treeTags.keys());
            n = tags.length;

            if (n > 0) {
                for (let i = 0; i < n; i++) {
                    let tagSet = this._treeTags.get(tags[i]);

                    // Remove from treeTags.
                    let p = this;
                    while ((p = p._parent) && !p._tagRoot) {
                        let parentTreeTags = p._treeTags.get(tags[i]);

                        tagSet.forEach(function (comp) {
                            parentTreeTags.delete(comp);
                        });


                        p._clearTagsCache(tags[i]);
                    }
                }
            }
        }
    };

    _setTagsParent() {
        if (!this._tagRoot && this._treeTags && this._treeTags.size) {
            let self = this;
            this._treeTags.forEach(function (tagSet, tag) {
                // Add to treeTags.
                let p = self;
                while ((p = p._parent) && !p._tagRoot) {
                    if (!p._treeTags) {
                        p._treeTags = new Map();
                    }

                    let s = p._treeTags.get(tag);
                    if (!s) {
                        s = new Set();
                        p._treeTags.set(tag, s);
                    }

                    tagSet.forEach(function (comp) {
                        s.add(comp);
                    });

                    p._clearTagsCache(tag);
                }
            });
        }
    };

    _getByTag(tag) {
        if (!this._treeTags) {
            return [];
        }
        let t = this._treeTags.get(tag);
        return t ? Utils.setToArray(t) : [];
    };

    getTags() {
        return this._tags ? this._tags : [];
    };

    setTags(tags) {
        let i, n = tags.length;
        let removes = [];
        let adds = [];
        for (i = 0; i < n; i++) {
            if (!this.hasTag(tags[i])) {
                adds.push(tags[i]);
            }
        }

        let currentTags = this.tags || [];
        n = currentTags.length;
        for (i = 0; i < n; i++) {
            if (tags.indexOf(currentTags[i]) == -1) {
                removes.push(currentTags[i]);
            }
        }

        for (i = 0; i < removes.length; i++) {
            this.removeTag(removes[i]);
        }

        for (i = 0; i < adds.length; i++) {
            this.addTag(adds[i]);
        }
    };

    addTag(tag) {
        if (!this._tags) {
            this._tags = [];
        }
        if (this._tags.indexOf(tag) === -1) {
            this._tags.push(tag);

            // Add to treeTags hierarchy.
            let p = this;
            do {
                if (!p._treeTags) {
                    p._treeTags = new Map();
                }

                let s = p._treeTags.get(tag);
                if (!s) {
                    s = new Set();
                    p._treeTags.set(tag, s);
                }

                s.add(this);

                p._clearTagsCache(tag);
            } while (p = p._parent);
        }
    };

    removeTag(tag) {
        let i = this._tags.indexOf(tag);
        if (i !== -1) {
            this._tags.splice(i, 1);

            // Remove from treeTags hierarchy.
            let p = this;
            do {
                let list = p._treeTags.get(tag);
                if (list) {
                    list.delete(this);

                    p._clearTagsCache(tag);
                }
            } while (p = p._parent);
        }
    };

    hasTag(tag) {
        return (this._tags && (this._tags.indexOf(tag) !== -1));
    };

    /**
     * Returns one of the views from the subtree that have this tag.
     * @param {string} tag
     * @returns {View}
     */
    _tag(tag) {
        let res = this.mtag(tag);
        return res[0];
    };

    get tag() {
        return this._tag;
    }

    set tag(t) {
        this.tags = t;
    }

    /**
     * Returns all views from the subtree that have this tag.
     * @param {string} tag
     * @returns {View[]}
     */
    mtag(tag) {
        let res = null;
        if (this._tagsCache) {
            res = this._tagsCache.get(tag);
        }

        if (!res) {
            let idx = tag.indexOf(".");
            if (idx >= 0) {
                let parts = tag.split('.');
                res = this._getByTag(parts[0]);
                let level = 1;
                let c = parts.length;
                while (res.length && level < c) {
                    let resn = [];
                    for (let j = 0, n = res.length; j < n; j++) {
                        resn = resn.concat(res[j]._getByTag(parts[level]));
                    }

                    res = resn;
                    level++;
                }
            } else {
                res = this._getByTag(tag);
            }

            if (!this._tagsCache) {
                this._tagsCache = new Map();
            }

            this._tagsCache.set(tag, res);
        }
        return res;
    };

    stag(tag, settings) {
        let t = this.mtag(tag);
        let n = t.length;
        for (let i = 0; i < n; i++) {
            t[i].setSettings(settings);
        }
    }

    get tagRoot() {
        return this._tagRoot;
    }

    set tagRoot(v) {
        if (this._tagRoot !== v) {
            if (!v) {
                this._setTagsParent();
            } else {
                this._unsetTagsParent();
            }

            this._tagRoot = v;
        }
    }

    getLocationString() {
        let i;
        if (this._parent) {
            i = this._parent._children.getIndex(this);
            if (i >= 0) {
                let localTags = this.getTags();
                return this._parent.getLocationString() + ":" + i + "[" + this.id + "]" + (localTags.length ? "(" + localTags.join(",") + ")" : "");
            }
        }
        return "";
    }

    toString() {
        let obj = this.getSettings();
        return View.getPrettyString(obj, "");
    };

    static getPrettyString(obj, indent) {
        let children = obj.children;
        delete obj.children;

        // Convert singular json settings object.
        let colorKeys = ["color", "colorUl", "colorUr", "colorBl", "colorBr"]
        let str = JSON.stringify(obj, function (k, v) {
            if (colorKeys.indexOf(k) !== -1) {
                return "COLOR[" + v.toString(16) + "]";
            }
            return v;
        });
        str = str.replace(/"COLOR\[([a-f0-9]{1,8})\]"/g, "0x$1");

        if (children && children.length) {
            let isEmpty = (str === "{}");
            str = str.substr(0, str.length - 1) + (isEmpty ? "" : ",") + "\"children\":[\n";
            let n = children.length;
            for (let i = 0; i < n; i++) {
                str += View.getPrettyString(children[i], indent + "  ") + (i < n - 1 ? "," : "") + "\n";
            }
            str += indent + "]}";
        }

        return indent + str;
    }

    getSettings() {
        let settings = this.getNonDefaults();

        let children = this._children.get();
        if (children) {
            let n = children.length;
            settings.children = [];
            for (let i = 0; i < n; i++) {
                settings.children.push(children[i].getSettings());
            }
        }

        return settings;
    }

    getNonDefaults() {
        let settings = {};

        if (this._tags && this._tags.length) {
            settings.tags = this._tags;
        }

        if (this._x !== 0) settings.x = this._x;
        if (this._y !== 0) settings.y = this._y;
        if (this._w !== 0) settings.w = this._w;
        if (this._h !== 0) settings.h = this._h;

        if (this._scaleX === this._scaleY) {
            if (this._scaleX !== 1) settings.scale = this._scaleX;
        } else {
            if (this._scaleX !== 1) settings.scaleX = this._scaleX;
            if (this._scaleY !== 1) settings.scaleY = this._scaleY;
        }

        if (this._pivotX === this._pivotY) {
            if (this._pivotX !== 0.5) settings.pivot = this._pivotX;
        } else {
            if (this._pivotX !== 0.5) settings.pivotX = this._pivotX;
            if (this._pivotY !== 0.5) settings.pivotY = this._pivotY;
        }

        if (this._mountX === this._mountY) {
            if (this._mountX !== 0) settings.mount = this._mountX;
        } else {
            if (this._mountX !== 0) settings.mountX = this._mountX;
            if (this._mountY !== 0) settings.mountY = this._mountY;
        }

        if (this._alpha !== 1) settings.alpha = this._alpha;

        if (this._rotation !== 0) settings.rotation = this._rotation;

        if (this._core.colorUl === this._core.colorUr && this._core.colorBl === this._core.colorBr && this._core.colorUl === this._core.colorBl) {
            if (this._core.colorUl !== 0xFFFFFFFF) settings.color = this._core.colorUl.toString(16);
        } else {
            if (this._core.colorUl !== 0xFFFFFFFF) settings.colorUl = this._core.colorUl.toString(16);
            if (this._core.colorUr !== 0xFFFFFFFF) settings.colorUr = this._core.colorUr.toString(16);
            if (this._core.colorBl !== 0xFFFFFFFF) settings.colorBl = this._core.colorBl.toString(16);
            if (this._core.colorBr !== 0xFFFFFFFF) settings.colorBr = this._core.colorBr.toString(16);
        }

        if (!this._visible) settings.visible = false;

        if (this._core.zIndex) settings.zIndex = this._core.zIndex;

        if (this._core.forceZIndexContext) settings.forceZIndexContext = true;

        if (this._core.clipping) settings.clipping = this._core.clipping;

        if (this.rect) {
            settings.rect = true;
        } else if (this.src) {
            settings.src = this.src;
        } else if (this.texture && this._viewText) {
            settings.text = this._viewText.settings.getNonDefaults();
        }

        if (this._texture) {
            let tnd = this._texture.getNonDefaults();
            if (Object.keys(tnd).length) {
                settings.texture = tnd;
            }
        }

        if (this._texturizer) {
            if (this._texturizer.enabled) {
                settings.renderToTexture = this._texturizer.enabled
            }
            if (this._texturizer.lazy) {
                settings.renderToTextureLazy = this._texturizer.lazy
            }
            if (this._texturizer.colorize) {
                settings.colorizeResultTexture = this._texturizer.colorize
            }
            if (this._texturizer.hideResult) {
                settings.hideResultTexture = this._texturizer.hideResult
            }
        }

        return settings;
    };

    setSettings(settings) {
        Base.setObjectSettings(this, settings);
    }

    static getGetter(propertyPath) {
        let getter = View.PROP_GETTERS.get(propertyPath);
        if (!getter) {
            getter = new Function('obj', 'return obj.' + propertyPath);
            View.PROP_GETTERS.set(propertyPath, getter);
        }
        return getter;
    }

    static getSetter(propertyPath) {
        let setter = View.PROP_SETTERS.get(propertyPath);
        if (!setter) {
            setter = new Function('obj', 'v', 'obj.' + propertyPath + ' = v');
            View.PROP_SETTERS.set(propertyPath, setter);
        }
        return setter;
    }

    get x() {
        return this._x
    }

    set x(v) {
        if (this._x !== v) {
            this._updateLocalTranslateDelta(v - this._x, 0)
            this._x = v
        }
    }

    get y() {
        return this._y
    }

    set y(v) {
        if (this._y !== v) {
            this._updateLocalTranslateDelta(0, v - this._y)
            this._y = v
        }
    }

    get w() {
        return this._w
    }

    set w(v) {
        if (this._w !== v) {
            this._w = v
            this._updateDimensions()
        }
    }

    get h() {
        return this._h
    }

    set h(v) {
        if (this._h !== v) {
            this._h = v
            this._updateDimensions()
        }
    }

    get scaleX() {
        return this._scaleX
    }

    set scaleX(v) {
        if (this._scaleX !== v) {
            this._scaleX = v
            this._updateLocalTransform()
        }
    }

    get scaleY() {
        return this._scaleY
    }

    set scaleY(v) {
        if (this._scaleY !== v) {
            this._scaleY = v
            this._updateLocalTransform()
        }
    }

    get scale() {
        return this._scaleX
    }

    set scale(v) {
        if (this._scaleX !== v || this._scaleY !== v) {
            this._scaleX = v
            this._scaleY = v
            this._updateLocalTransform()
        }
    }

    get pivotX() {
        return this._pivotX
    }

    set pivotX(v) {
        if (this._pivotX !== v) {
            this._pivotX = v
            this._updateLocalTranslate()
        }
    }

    get pivotY() {
        return this._pivotY
    }

    set pivotY(v) {
        if (this._pivotY !== v) {
            this._pivotY = v
            this._updateLocalTranslate()
        }
    }

    get pivot() {
        return this._pivotX
    }

    set pivot(v) {
        if (this._pivotX !== v || this._pivotY !== v) {
            this._pivotX = v;
            this._pivotY = v;
            this._updateLocalTranslate()
        }
    }

    get mountX() {
        return this._mountX
    }

    set mountX(v) {
        if (this._mountX !== v) {
            this._mountX = v
            this._updateLocalTranslate()
        }
    }

    get mountY() {
        return this._mountY
    }

    set mountY(v) {
        if (this._mountY !== v) {
            this._mountY = v
            this._updateLocalTranslate()
        }
    }

    get mount() {
        return this._mountX
    }

    set mount(v) {
        if (this._mountX !== v || this._mountY !== v) {
            this._mountX = v
            this._mountY = v
            this._updateLocalTranslate()
        }
    }

    get alpha() {
        return this._alpha
    }

    set alpha(v) {
        // Account for rounding errors.
        v = (v > 1 ? 1 : (v < 1e-14 ? 0 : v));
        if (this._alpha !== v) {
            let prev = this._alpha
            this._alpha = v
            this._updateLocalAlpha();
            if ((prev === 0) !== (v === 0)) this._updateActiveFlag()
        }
    }

    get rotation() {
        return this._rotation
    }

    set rotation(v) {
        if (this._rotation !== v) {
            this._rotation = v
            this._updateLocalTransform()
        }
    }

    get colorUl() {
        return this._core.colorUl
    }

    set colorUl(v) {
        this._core.colorUl = v;
    }

    get colorUr() {
        return this._core.colorUr
    }

    set colorUr(v) {
        this._core.colorUr = v;
    }

    get colorBl() {
        return this._core.colorBl
    }

    set colorBl(v) {
        this._core.colorBl = v;
    }

    get colorBr() {
        return this._core.colorBr
    }

    set colorBr(v) {
        this._core.colorBr = v;
    }

    get color() {
        return this._core.colorUl
    }

    set color(v) {
        if (this.colorUl !== v || this.colorUr !== v || this.colorBl !== v || this.colorBr !== v) {
            this.colorUl = v;
            this.colorUr = v;
            this.colorBl = v;
            this.colorBr = v;
        }
    }

    get colorTop() {
        return this.colorUl
    }

    set colorTop(v) {
        if (this.colorUl !== v || this.colorUr !== v) {
            this.colorUl = v;
            this.colorUr = v;
        }
    }

    get colorBottom() {
        return this.colorBl
    }

    set colorBottom(v) {
        if (this.colorBl !== v || this.colorBr !== v) {
            this.colorBl = v;
            this.colorBr = v;
        }
    }

    get colorLeft() {
        return this.colorUl
    }

    set colorLeft(v) {
        if (this.colorUl !== v || this.colorBl !== v) {
            this.colorUl = v;
            this.colorBl = v;
        }
    }

    get colorRight() {
        return this.colorUr
    }

    set colorRight(v) {
        if (this.colorUr !== v || this.colorBr !== v) {
            this.colorUr = v;
            this.colorBr = v;
        }
    }

    get visible() {
        return this._visible
    }

    set visible(v) {
        if (this._visible !== v) {
            this._visible = v
            this._updateLocalAlpha()
            this._updateActiveFlag()
        }
    }

    get zIndex() {return this._core.zIndex}
    set zIndex(v) {
        let prev = this._core.zIndex;
        this._core.zIndex = v;
    }

    get forceZIndexContext() {return this._core.forceZIndexContext}
    set forceZIndexContext(v) {
        this._core.forceZIndexContext = v;
    }

    get clipping() {return this._core.clipping}
    set clipping(v) {
        this._core.clipping = v;
    }

    get tags() {
        return this.getTags();
    }

    set tags(v) {
        if (!Array.isArray(v)) v = [v];
        this.setTags(v);
    }

    set t(v) {
        this.tags = v;
    }

    get _children() {
        if (!this._childList) {
            this._childList = new ViewChildList(this, false)
        }
        return this._childList
    }

    get _lchildren() {
        return this._childList.get()
    }

    get childList() {
        if (!this._exposedChildList) {
            this._exposedChildList = this._getExposedChildList()
        }
        return this._exposedChildList
    }

    _getExposedChildList() {
        return this._children
    }

    get children() {
        return this.childList.get()
    }

    set children(children) {
        this.childList.set(children)
    }

    getChildren() {
        return this.childList.get();
    }

    addChild(child) {
        return this.childList.add(child);
    }

    addChildAt(child, index) {
        return this.childList.addAt(child, index);
    }

    getChildIndex(child) {
        return this.childList.getIndex(child);
    }

    removeChild(child) {
        return this.childList.remove(child);
    }

    removeChildAt(index) {
        return this.childList.removeAt(index);
    }

    removeChildren() {
        return this.childList.clear();
    }

    add(o) {
        return this.childList.a(o);
    }

    get parent() {
        return this._parent;
    }

    get src() {
        if (this.texture && this.texture.source && this.texture.source.renderInfo && this.texture.source.renderInfo.src) {
            return this.texture.source.renderInfo.src;
        } else {
            return null;
        }
    }

    set src(v) {
        if (!v) {
            this.texture = null;
        } else if (!this.texture || !this.texture.source.renderInfo || this.texture.source.renderInfo.src !== v) {
            this.texture = this.stage.textureManager.getTexture(v);
        }
    }

    get rect() {
        return (this.texture === this.stage.rectangleTexture);
    }

    set rect(v) {
        if (v) {
            this.texture = this.stage.rectangleTexture;
        } else {
            this.texture = null;
        }
    }

    get text() {
        if (!this._viewText) {
            this._viewText = new ViewText(this);
        }

        // Give direct access to the settings.
        return this._viewText.settings;
    }

    set text(v) {
        if (!this._viewText) {
            this._viewText = new ViewText(this);
        }
        if (Utils.isString(v)) {
            this._viewText.settings.text = v;
        } else {
            this._viewText.settings.setSettings(v);
        }
    }

    set visitEntry(f) {
        this._core.visitEntry = f;
    }

    set visitExit(f) {
        this._core.visitExit = f;
    }

    get shader() {
        return this._core.shader;
    }

    set shader(v) {
        let shader;
        if (Utils.isObjectLiteral(v)) {
            if (v.type) {
                shader = new v.type(this.stage.ctx)
            } else {
                shader = this.shader
            }

            if (shader) {
                shader.setSettings(v);
            }
        } else if (v === null) {
            shader = this.stage.ctx.renderState.defaultShader;
        } else {
            if (v.isShader) {
                shader = v;
            } else {
                console.error("Please specify a shader type.");
                return
            }
        }
        this._core.shader = shader;
    }

    get renderToTexture() {
        return this._core._texturizer && this.texturizer.enabled
    }

    set renderToTexture(v) {
        this.texturizer.enabled = v
    }

    get renderToTextureLazy() {
        return this._core._texturizer && this.texturizer.lazy
    }

    set renderToTextureLazy(v) {
        this.texturizer.lazy = v
    }

    get hideResultTexture() {
        return this._core._texturizer && this.texturizer.hideResult
    }

    set hideResultTexture(v) {
        this.texturizer.hideResult = v
    }

    get colorizeResultTexture() {
        return this._texturizer && this.texturizer.colorize
    }

    set colorizeResultTexture(v) {
        this.texturizer.colorize = v
    }

    get filters() {
        return this.texturizer.filters
    }

    set filters(v) {
        this.texturizer.filters = v
    }

    getResultTextureSource() {
        return this.texturizer.getResultTextureSource()
    }

    get texturizer() {
        return this._core.texturizer
    }

    /*A¬*/
    animation(settings) {
        return this.stage.animations.createAnimation(this, settings);
    }

    transition(property, settings) {
        if (settings === undefined) {
            return this._getTransition(property);
        } else {
            this._setTransition(property, settings);
            return null;
        }
    }

    set transitions(object) {
        let keys = Object.keys(object);
        keys.forEach(property => {
            this.transition(property, object[property]);
        });
    }

    fastForward(property) {
        if (this._transitions) {
            let t = this._transitions[property];
            if (t && t.isTransition) {
                t.finish();
            }
        }
    }

    _getTransition(property) {
        if (!this._transitions) {
            this._transitions = {};
        }
        let t = this._transitions[property];
        if (!t) {
            // Create default transition.
            t = new Transition(this.stage.transitions, this.stage.transitions.defaultTransitionSettings, this, property);
        } else if (t.isTransitionSettings) {
            // Upgrade to 'real' transition.
            t = new Transition(
                this.stage.transitions,
                t,
                this,
                property
            );
        }
        this._transitions[property] = t;
        return t;
    }

    _setTransition(property, settings) {
        if (!settings) {
            this._removeTransition(property);
        }
        if (Utils.isObjectLiteral(settings)) {
            // Convert plain object to proper settings object.
            settings = this.stage.transitions.createSettings(settings);
        }

        if (!this._transitions) {
            this._transitions = {};
        }

        let current = this._transitions[property];
        if (current && current.isTransition) {
            // Runtime settings change.
            current.settings = settings;
            return current;
        } else {
            // Initially, only set the settings and upgrade to a 'real' transition when it is used.
            this._transitions[property] = settings;
        }
    }

    _removeTransition(property) {
        if (this._transitions) {
            delete this._transitions[property];
        }
    }

    getSmooth(property, v) {
        let t = this._getTransition(property);
        if (t && t.isActive()) {
            return t.targetValue;
        } else {
            return v;
        }
    }

    setSmooth(property, v, settings) {
        if (settings) {
            this._setTransition(property, settings);
        }
        let t = this._getTransition(property);
        t.start(v);
        return t
    }

    get X() {
        return this.getSmooth('x', this.x);
    }

    set X(v) {
        this.setSmooth('x', v)
    }

    get Y() {
        return this.getSmooth('y', this.y);
    }

    set Y(v) {
        this.setSmooth('y', v)
    }

    get W() {
        return this.getSmooth('w', this.w);
    }

    set W(v) {
        return this.setSmooth('w', v);
    }

    get H() {
        return this.getSmooth('h', this.h);
    }

    set H(v) {
        this.setSmooth('h', v)
    }

    get SCALE() {
        return this.getSmooth('scale', this.scale);
    }

    set SCALE(v) {
        this.setSmooth('scale', v)
    }

    get SCALEX() {
        return this.getSmooth('scaleX', this.scaleX);
    }

    set SCALEX(v) {
        this.setSmooth('scaleX', v)
    }

    get PIVOT() {
        return this.getSmooth('pivot', this.pivot);
    }

    set PIVOT(v) {
        this.setSmooth('pivot', v)
    }

    get PIVOTX() {
        return this.getSmooth('pivotX', this.pivotX);
    }

    set PIVOTX(v) {
        this.setSmooth('pivotX', v)
    }

    get MOUNT() {
        return this.getSmooth('mount', this.mount);
    }

    set MOUNT(v) {
        this.setSmooth('mount', v)
    }

    get MOUNTX() {
        return this.getSmooth('mountX', this.mountX);
    }

    set MOUNTX(v) {
        this.setSmooth('mountX', v)
    }

    get ALPHA() {
        return this.getSmooth('alpha', this.alpha);
    }

    set ALPHA(v) {
        this.setSmooth('alpha', v)
    }

    get ROTATION() {
        return this.getSmooth('rotation', this.rotation);
    }

    set ROTATION(v) {
        this.setSmooth('rotation', v)
    }

    get COLOR() {
        return this.getSmooth('color', this.color);
    }

    set COLOR(v) {
        this.setSmooth('color', v)
    }

    set COLORTOP(v) {
        this.setSmooth('colorTop', v)
    }

    set COLORBOTTOM(v) {
        this.setSmooth('colorBottom', v)
    }

    set COLORLEFT(v) {
        this.setSmooth('colorLeft', v)
    }

    set COLORRIGHT(v) {
        this.setSmooth('colorRight', v)
    }

    get COLORUL() {
        return this.getSmooth('colorUl', this.colorUl);
    }

    set COLORUL(v) {
        this.setSmooth('colorUl', v)
    }

    get COLORUR() {
        return this.getSmooth('colorUr', this.colorUr);
    }

    set COLORUR(v) {
        this.setSmooth('colorUr', v)
    }

    get COLORBL() {
        return this.getSmooth('colorBl', this.colorBl);
    }

    set COLORBL(v) {
        this.setSmooth('colorBl', v)
    }

    get COLORBR() {
        return this.getSmooth('colorBr', this.colorBr);
    }

    set COLORBR(v) {
        this.setSmooth('colorBr', v)
    }
    /*¬A*/

    isNumberProperty(property) {
        return View.isNumberProperty(property, this.constructor);
    }

    isColorProperty(property) {
        return View.isColorProperty(property, this.constructor);
    }

}

View.isNumberProperty = function(property, type = View) {
    do {
        if (type.NUMBER_PROPERTIES && type.NUMBER_PROPERTIES.has(property)) {
            return true
        }
    } while((type !== View) && (type = Object.getPrototypeOf(type)));

    return false
}

View.isColorProperty = function(property, type = View) {
    do {
        if (type.COLOR_PROPERTIES && type.COLOR_PROPERTIES.has(property)) {
            return true
        }
    } while((type !== View) && (type = Object.getPrototypeOf(type)));

    return false
}

View.getMerger = function(property, type = View) {
    if (View.isNumberProperty(property, type)) {
        return StageUtils.mergeNumbers
    } else if (View.isColorProperty(property, type)) {
        return StageUtils.mergeColors
    } else {
        return undefined
    }
}

View.NUMBER_PROPERTIES = new Set(['x', 'y', 'w', 'h', 'scale', 'scaleX', 'scaleY', 'pivot', 'pivotX', 'pivotY', 'mount', 'mountX', 'mountY', 'alpha', 'rotation', 'texture.x', 'texture.y', 'texture.w', 'texture.h'])
View.COLOR_PROPERTIES = new Set(['color', 'colorTop', 'colorBottom', 'colorLeft', 'colorRight', 'colorUl', 'colorUr', 'colorBl', 'colorBr'])

View.prototype.isView = 1;

View.id = 1;

// Getters reused when referencing view (subobject) properties by a property path, as used in a transition or animation ('x', 'texture.x', etc).
View.PROP_GETTERS = new Map();

// Setters reused when referencing view (subobject) properties by a property path, as used in a transition or animation ('x', 'texture.x', etc).
View.PROP_SETTERS = new Map();

let Utils = require('./Utils');
/*M¬*/let EventEmitter = require(Utils.isNode ? 'events' : '../browser/EventEmitter');/*¬M*/

Base.mixinEs5(View, EventEmitter);

module.exports = View;

let ViewText = require('./ViewText');
let Texture = require('./Texture');
let TextureSource = require('./TextureSource')
/*A¬*/let Transition = require('../animation/Transition')
let TransitionSettings = require('../animation/TransitionSettings')/*¬A*/
let ViewChildList = require('./ViewChildList');
