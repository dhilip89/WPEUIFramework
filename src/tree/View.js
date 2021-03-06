/**
 * Render tree node.
 * Copyright Metrological, 2017
 */

let StageUtils = require('./StageUtils');
let ViewCore = require('./core/ViewCore');
let Base = require('./Base');

let Utils = require('./Utils');
/*M¬*/let EventEmitter = require(Utils.isNode ? 'events' : '../browser/EventEmitter');/*¬M*/

class View extends EventEmitter {

    constructor(stage) {
        super()

        this.__id = View.id++;

        this.stage = stage;

        this.__core = new ViewCore(this);

        /**
         * A reference that can be used while merging trees.
         * @type {string}
         */
        this.__ref = null;

        /**
         * A view is attached if it is a descendant of the stage root.
         * @type {boolean}
         */
        this.__attached = false;

        /**
         * A view is enabled when it is attached and it is visible (worldAlpha > 0).
         * @type {boolean}
         */
        this.__enabled = false;

        /**
         * A view is active when it is enabled and it is within bounds.
         * @type {boolean}
         */
        this.__active = false;

        /**
         * @type {View}
         */
        this.__parent = null;

        /**
         * The texture that is currently set.
         * @type {Texture}
         * @protected
         */
        this.__texture = null;

        /**
         * The currently displayed texture. While this.texture is loading, this one may be different.
         * @type {Texture}
         * @protected
         */
        this.__displayedTexture = null;

        /**
         * Tags that can be used to identify/search for a specific view.
         * @type {String[]}
         */
        this.__tags = null;

        /**
         * The tree's tags mapping.
         * This contains all views for all known tags, at all times.
         * @type {Map}
         */
        this.__treeTags = null;

        /**
         * Cache for the tag/mtag methods.
         * @type {Map<String,View[]>}
         */
        this.__tagsCache = null;

        /**
         * Tag-to-complex cache (all tags that are part of the complex caches).
         * This maps tags to cached complex tags in the cache.
         * @type {Map<String,String[]>}
         */
        this.__tagToComplex = null;

        /**
         * Creates a tag context: tagged views in this branch will not be reachable from ancestors of this view.
         * @type {boolean}
         * @private
         */
        this.__tagRoot = false;

        this.__x = 0;
        this.__y = 0;
        this.__w = 0;
        this.__h = 0;
        this.__scaleX = 1;
        this.__scaleY = 1;
        this.__pivotX = 0.5;
        this.__pivotY = 0.5;
        this.__mountX = 0;
        this.__mountY = 0;
        this.__alpha = 1;
        this.__rotation = 0;
        this.__visible = true;

        /**
         * The text functionality in case this view is a text view.
         * @type {ViewText}
         */
        this.__viewText = null;

        /**
         * (Lazy-initialised) list of children owned by this view.
         * @type {ViewChildList}
         */
        this.__childList = null;

    }
    
    get id() {
        return this.__id
    }

    set ref(ref) {
        if (this.__ref !== ref) {
            const charcode = ref.charCodeAt(0)
            if (!Utils.isUcChar(charcode)) {
                this._throwError("Ref must start with an upper case character: " + ref)
            }
            if (this.__ref !== null) {
                this.removeTag(this.__ref)
            }
            this.__ref = ref
            this._addTag(this.__ref)
        }
    }

    get ref() {
        return this.__ref
    }

    get core() {
        return this.__core
    }

    setAsRoot() {
        this._updateAttachedFlag();
        this._updateEnabledFlag();
        this.__core.setAsRoot();
    }

    get isRoot() {
        return this.__core.isRoot
    }

    _setParent(parent) {
        if (this.__parent === parent) return;

        if (this.__parent) {
            this._unsetTagsParent();
        }

        this.__parent = parent;

        if (parent) {
            this._setTagsParent();
        }

        this._updateAttachedFlag();
        this._updateEnabledFlag();

        if (this.isRoot && parent) {
            this._throwError("Root should not be added as a child! Results are unspecified!")
        }
    };

    getDepth() {
        let depth = 0;

        let p = this.__parent;
        while(p) {
            depth++;
            p = p.__parent;
        }

        return depth;
    };

    getAncestor(l) {
        let p = this;
        while (l > 0 && p.__parent) {
            p = p.__parent;
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

            o1 = o1.__parent;
            o2 = o2.__parent;
        } while (o1 && o2);

        return null;
    };

    get attached() {
        return this.__attached
    }

    get enabled() {
        return this.__enabled
    }

    get active() {
        return this.__active
    }

    isAttached() {
        return (this.__parent ? this.__parent.__attached : (this.stage.root === this));
    };

    isEnabled() {
        return this.__visible && (this.__alpha > 0) && (this.__parent ? this.__parent.__enabled : (this.stage.root === this));
    };

    isActive() {
        return this.isEnabled() && this.withinBoundsMargin;
    };

    /**
     * Updates the 'attached' flag for this branch.
     */
    _updateAttachedFlag() {
        let newAttached = this.isAttached();
        if (this.__attached !== newAttached) {
            this.__attached = newAttached;

            let children = this._children.get();
            if (children) {
                let m = children.length;
                if (m > 0) {
                    for (let i = 0; i < m; i++) {
                        children[i]._updateAttachedFlag();
                    }
                }
            }

            if (newAttached) {
                this.emit('attach');
            } else {
                this.emit('detach');
            }
        }
    };

    /**
     * Updates the 'enabled' flag for this branch.
     */
    _updateEnabledFlag() {
        let newEnabled = this.isEnabled();
        if (this.__enabled !== newEnabled) {
            if (newEnabled) {
                this._setEnabledFlag();
            } else {
                this._unsetEnabledFlag();
            }

            let children = this._children.get();
            if (children) {
                let m = children.length;
                if (m > 0) {
                    for (let i = 0; i < m; i++) {
                        children[i]._updateEnabledFlag();
                    }
                }
            }

            // Run this after all _children because we'd like to see (de)activating a branch as an 'atomic' operation.
            if (newEnabled) {
                this.emit('enabled');
            } else {
                this.emit('disabled');
            }
        }
    };

    _setEnabledFlag() {
        // Force re-check of texture because dimensions might have changed (cutting).
        this._updateDimensions();
        this._updateTextureCoords();

        this.__enabled = true;

        if (this.__texture) {
            // It is important to add the source listener before the texture listener because that may trigger a load.
            this.__texture.source.addView(this)
        }

        if (this.withinBoundsMargin) {
            this._setActiveFlag()
        }

        if (this.__core.shader) {
            this.__core.shader.addView(this.__core);
        }

        if (this._texturizer) {
            this.texturizer.filters.forEach(filter => filter.addView(this.__core))
        }

    }

    _unsetEnabledFlag() {
        if (this.__active) {
            this._unsetActiveFlag()
        }

        if (this.__texture) {
            this.__texture.source.removeView(this)
        }

        if (this.__core.shader) {
            this.__core.shader.removeView(this.__core);
        }

        if (this._texturizer) {
            this.texturizer.filters.forEach(filter => filter.removeView(this.__core))
        }

        this.__enabled = false;
    }

    _setActiveFlag() {
        this.__active = true
        if (this.__texture) {
            this._enableTexture()
        }
        this.emit('active')
    }

    _unsetActiveFlag() {
        this.__active = false;
        if (this.__texture) {
            this._disableTexture()
        }

        if (this._hasTexturizer()) {
            this.texturizer.deactivate();
        }

        this.emit('inactive')
    }

    _getRenderWidth() {
        if (this.__w) {
            return this.__w;
        } else if (this.__displayedTexture) {
            return this.__displayedTexture.getRenderWidth()
        } else if (this.__texture) {
            // Texture already loaded, but not yet updated (probably because this view is not active).
            return this.__texture.getRenderWidth()
        } else {
            return 0;
        }
    };

    _getRenderHeight() {
        if (this.__h) {
            return this.__h;
        } else if (this.__displayedTexture) {
            return this.__displayedTexture.getRenderHeight()
        } else if (this.__texture) {
            // Texture already loaded, but not yet updated (probably because this view is not active).
            return this.__texture.getRenderHeight()
        } else {
            return 0;
        }
    };

    get renderWidth() {
        if (this.__enabled) {
            // Render width is only maintained if this view is enabled.
            return this.__core._rw;
        } else {
            return this._getRenderWidth();
        }
    }

    get renderHeight() {
        if (this.__enabled) {
            return this.__core._rh;
        } else {
            return this._getRenderHeight();
        }
    }

    textureIsLoaded() {
        return this.texture ? !!this.texture.source.glTexture : false;
    }

    loadTexture(sync) {
        if (this.texture) {
            this.texture.source.load(sync);
        }
    }

    _enableTexture() {
        // Detect texture changes.
        let dt = null;
        if (this.__texture && this.__texture.source.glTexture) {
            dt = this.__texture;
        }

        // We must force because the texture source may have been replaced while being invisible.
        this._setDisplayedTexture(dt)
    }

    _disableTexture() {
        // We disable the displayed texture because, when the texture changes while invisible, we should use that w, h,
        // mw, mh for checking within bounds.
        this._setDisplayedTexture(null)
    }

    get texture() {
        return this.__texture;
    }

    set texture(v) {
        if (v && Utils.isObjectLiteral(v)) {
            if (this.texture) {
                this.texture.patch(v);
            } else {
                console.warn('Trying to set texture properties, but there is no texture.');
            }
            return;
        }

        let prevValue = this.__texture;
        if (v !== prevValue) {
            if (v !== null) {
                if (v instanceof TextureSource) {
                    v = this.stage.texture(v);
                } else if (!(v instanceof Texture)) {
                    console.error('incorrect value for texture');
                    return;
                }
            }

            this.__texture = v;

            if (this.__enabled) {
                if (prevValue && (!v || prevValue.source !== v.source) && (!this.displayedTexture || (this.displayedTexture.source !== prevValue.source))) {
                    prevValue.source.removeView(this);
                }

                if (v) {
                    // When the texture is changed, maintain the texture's sprite registry.
                    // While the displayed texture is different from the texture (not yet loaded), two textures are referenced.
                    v.source.addView(this);
                }
            }

            if (v) {
                if (v.source.glTexture && this.__enabled && this.withinBoundsMargin) {
                    this._setDisplayedTexture(v);
                }
            } else {
                // Make sure that current texture is cleared when the texture is explicitly set to null.
                // This also makes sure that dimensions are updated.
                this._setDisplayedTexture(null);
            }

            this._updateDimensions()
        }
    }

    get displayedTexture() {
        return this.__displayedTexture;
    }

    _setDisplayedTexture(v) {
        let prevValue = this.__displayedTexture;

        const changed = (v !== prevValue || (v && v.source !== prevValue.source))

        if (prevValue && (prevValue !== this.__texture)) {
            if (!v || (prevValue.source !== v.source)) {
                // The old displayed texture is deprecated.
                prevValue.source.removeView(this);
            }
        }

        this.__displayedTexture = v;

        if (this.__displayedTexture) {
            // We can manage views here because we know for sure that the view is both visible and within bounds.
            this.__displayedTexture.source.addView(this)
        }

        this._updateDimensions();

        if (v) {
            // We don't need to reference the displayed texture because it was already referenced (this.texture === this.displayedTexture).
            this._updateTextureCoords();
            this.__core.setDisplayedTextureSource(v.source);
        } else {
            this.__core.setDisplayedTextureSource(null);
        }

        if (changed) {
            if (v) {
                this.emit('txLoaded', v);
            } else {
                this.emit('txUnloaded', v);
            }
        }
    }

    onTextureSourceLoaded() {
        // We may be dealing with a texture reloading, so we must force update.
        this._setDisplayedTexture(this.__texture);
    };

    onTextureSourceLoadError(e) {
        this.emit('txError', e, this.__texture.source);
    };

    forceRenderUpdate() {
        this.__core.setHasRenderUpdates(3)
    }

    onDisplayedTextureClippingChanged() {
        this._updateDimensions();
        this._updateTextureCoords();
    };

    onPrecisionChanged() {
        this._updateDimensions();
    };

    _updateDimensions() {
        let beforeW = this.__core.rw;
        let beforeH = this.__core.rh;
        let rw = this._getRenderWidth();
        let rh = this._getRenderHeight();
        if (beforeW !== rw || beforeH !== rh) {
            // Due to width/height change: update the translation vector and borders.
            this.__core.setDimensions(rw, rh);
            this._updateLocalTranslate();

            // Returning whether there was an update is handy for extending classes.
            return true
        }
        return false
    }

    _updateLocalTransform() {
        if (this.__rotation !== 0 && this.__rotation % (2 * Math.PI)) {
            // check to see if the rotation is the same as the previous render. This means we only need to use sin and cos when rotation actually changes
            let _sr = Math.sin(this.__rotation);
            let _cr = Math.cos(this.__rotation);

            this.__core.setLocalTransform(
                _cr * this.__scaleX,
                -_sr * this.__scaleY,
                _sr * this.__scaleX,
                _cr * this.__scaleY
            );
        } else {
            this.__core.setLocalTransform(
                this.__scaleX,
                0,
                0,
                this.__scaleY
            );
        }
        this._updateLocalTranslate();
    };

    _updateLocalTranslate() {
        let pivotXMul = this.__pivotX * this.__core.rw;
        let pivotYMul = this.__pivotY * this.__core.rh;
        let px = this.__x - (pivotXMul * this.__core.localTa + pivotYMul * this.__core.localTb) + pivotXMul;
        let py = this.__y - (pivotXMul * this.__core.localTc + pivotYMul * this.__core.localTd) + pivotYMul;
        px -= this.__mountX * this.renderWidth;
        py -= this.__mountY * this.renderHeight;
        this.__core.setLocalTranslate(
            px,
            py
        );
    };

    _updateLocalTranslateDelta(dx, dy) {
        this.__core.addLocalTranslate(dx, dy)
    };

    _updateLocalAlpha() {
        this.__core.setLocalAlpha(this.__visible ? this.__alpha : 0);
    };

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

                let prec = displayedTexture.precision;

                if (displayedTexture.pw) {
                    rw = (displayedTexture.pw) * iw;
                } else {
                    rw = (w - displayedTexture.px) * iw;
                }

                if (displayedTexture.ph) {
                    rh = displayedTexture.ph * ih;
                } else {
                    rh = (h - displayedTexture.py) * ih;
                }

                iw *= (displayedTexture.px);
                ih *= (displayedTexture.py);

                tx1 = Math.min(1.0, Math.max(0, iw));
                ty1 = Math.min(1.0, Math.max(ih));
                tx2 = Math.min(1.0, Math.max(tx2 * rw + iw));
                ty2 = Math.min(1.0, Math.max(ty2 * rh + ih));
            }

            this.__core.setTextureCoords(tx1, ty1, tx2, ty2);
        }
    }

    getCornerPoints() {
        return this.__core.getCornerPoints();
    }

    /**
     * Clears the cache(s) for the specified tag.
     * @param {String} tag
     */
    _clearTagsCache(tag) {
        if (this.__tagsCache) {
            this.__tagsCache.delete(tag);

            if (this.__tagToComplex) {
                let s = this.__tagToComplex.get(tag);
                if (s) {
                    for (let i = 0, n = s.length; i < n; i++) {
                        this.__tagsCache.delete(s[i]);
                    }
                    this.__tagToComplex.delete(tag);
                }
            }
        }
    };

    _unsetTagsParent() {
        let tags = null;
        let n = 0;
        if (this.__treeTags) {
            if (this.__tagRoot) {
                // Just need to remove the 'local' tags.
                if (this.__tags) {
                    this.__tags.forEach((tag) => {
                        // Remove from treeTags.
                        let p = this;
                        while (p = p.__parent) {
                            let parentTreeTags = p.__treeTags.get(tag);
                            parentTreeTags.delete(this);
                            p._clearTagsCache(tag);

                            if (p.__tagRoot) {
                                break
                            }
                        }
                    });
                }
            } else {
                tags = Utils.iteratorToArray(this.__treeTags.keys());
                n = tags.length;

                if (n > 0) {
                    for (let i = 0; i < n; i++) {
                        let tagSet = this.__treeTags.get(tags[i]);

                        // Remove from treeTags.
                        let p = this;
                        while ((p = p.__parent) && !p.__tagRoot) {
                            let parentTreeTags = p.__treeTags.get(tags[i]);

                            tagSet.forEach(function (comp) {
                                parentTreeTags.delete(comp);
                            });


                            p._clearTagsCache(tags[i]);
                        }
                    }
                }
            }
        }
    };

    _setTagsParent() {
        if (this.__treeTags && this.__treeTags.size) {
            if (this.__tagRoot) {
                // Just copy over the 'local' tags.
                if (this.__tags) {
                    this.__tags.forEach((tag) => {
                        let p = this
                        while (p = p.__parent) {
                            if (!p.__treeTags) {
                                p.__treeTags = new Map();
                            }

                            let s = p.__treeTags.get(tag);
                            if (!s) {
                                s = new Set();
                                p.__treeTags.set(tag, s);
                            }

                            s.add(this);

                            p._clearTagsCache(tag);

                            if (p.__tagRoot) {
                                break
                            }
                        }
                    });
                }
            } else {
                this.__treeTags.forEach((tagSet, tag) => {
                    let p = this
                    while (!p.__tagRoot && (p = p.__parent)) {
                        if (p.__tagRoot) {
                            // Do not copy all subs.
                        }
                        if (!p.__treeTags) {
                            p.__treeTags = new Map();
                        }

                        let s = p.__treeTags.get(tag);
                        if (!s) {
                            s = new Set();
                            p.__treeTags.set(tag, s);
                        }

                        tagSet.forEach(function (comp) {
                            s.add(comp);
                        });

                        p._clearTagsCache(tag);
                    }
                });
            }
        }
    };


    _getByTag(tag) {
        if (!this.__treeTags) {
            return [];
        }
        let t = this.__treeTags.get(tag);
        return t ? Utils.setToArray(t) : [];
    };

    getTags() {
        return this.__tags ? this.__tags : [];
    };

    setTags(tags) {
        tags = tags.reduce((acc, tag) => {
            return acc.concat(tag.split(' '))
        }, [])

        if (this.__ref) {
            tags.push(this.__ref)
        }

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
    }

    addTag(tag) {
        if (tag.indexOf(' ') === -1) {
            if (Utils.isUcChar(tag.charCodeAt(0))) {
                this._throwError("Tag may not start with an upper case character.")
            }

            this._addTag(tag)
        } else {
            const tags = tag.split(' ')
            for (let i = 0, m = tags.length; i < m; i++) {
                const tag = tags[i]

                if (Utils.isUcChar(tag.charCodeAt(0))) {
                    this._throwError("Tag may not start with an upper case character.")
                }

                this._addTag(tag)
            }
        }
    }

    _addTag(tag) {
        if (!this.__tags) {
            this.__tags = [];
        }
        if (this.__tags.indexOf(tag) === -1) {
            this.__tags.push(tag);

            // Add to treeTags hierarchy.
            let p = this;
            do {
                if (!p.__treeTags) {
                    p.__treeTags = new Map();
                }

                let s = p.__treeTags.get(tag);
                if (!s) {
                    s = new Set();
                    p.__treeTags.set(tag, s);
                }

                s.add(this);

                p._clearTagsCache(tag);
            } while (p = p.__parent);
        }
    }

    removeTag(tag) {
        let i = this.__tags.indexOf(tag);
        if (i !== -1) {
            this.__tags.splice(i, 1);

            // Remove from treeTags hierarchy.
            let p = this;
            do {
                let list = p.__treeTags.get(tag);
                if (list) {
                    list.delete(this);

                    p._clearTagsCache(tag);
                }
            } while (p = p.__parent);
        }
    }

    hasTag(tag) {
        return (this.__tags && (this.__tags.indexOf(tag) !== -1));
    }

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
        if (this.__tagsCache) {
            res = this.__tagsCache.get(tag);
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

            if (!this.__tagsCache) {
                this.__tagsCache = new Map();
            }

            this.__tagsCache.set(tag, res);
        }
        return res;
    };

    stag(tag, settings) {
        let t = this.mtag(tag);
        let n = t.length;
        for (let i = 0; i < n; i++) {
            Base.patchObject(t[i], settings)
        }
    }

    get tagRoot() {
        return this.__tagRoot;
    }

    set tagRoot(v) {
        if (this.__tagRoot !== v) {
            if (!v) {
                this._setTagsParent();
            } else {
                this._unsetTagsParent();
            }

            this.__tagRoot = v;
        }
    }

    sel(path) {
        const results = this.select(path)
        if (results.length) {
            return results[0]
        } else {
            return undefined
        }
    }

    select(path) {
        if (path.indexOf(",") !== -1) {
            let selectors = path.split(',')
            let res = []
            for (let i = 0; i < selectors.length; i++) {
                res = res.concat(this._select(selectors[i]))
            }
            return res
        } else {
            return this._select(path)
        }
    }

    _select(path) {
        if (path === "") return [this]
        let pointIdx = path.indexOf(".")
        let arrowIdx = path.indexOf(">")
        if (pointIdx === -1 && arrowIdx === -1) {
            // Quick case.
            if (Utils.isUcChar(path.charCodeAt(0))) {
                const ref = this.getByRef(path)
                return ref ? [ref] : []
            } else {
                return this.mtag(path)
            }
        }

        // Detect by first char.
        let isChild
        if (arrowIdx === 0) {
            isChild = true
            path = path.substr(1)
        } else if (pointIdx === 0) {
            isChild = false
            path = path.substr(1)
        } else {
            const firstCharcode = path.charCodeAt(0)
            isChild = Utils.isUcChar(firstCharcode)
        }

        if (isChild) {
            // ">"
            return this._selectChilds(path)
        } else {
            // "."
            return this._selectDescs(path)
        }
    }

    _selectChilds(path) {
        const pointIdx = path.indexOf(".")
        const arrowIdx = path.indexOf(">")

        let isRef = Utils.isUcChar(path.charCodeAt(0))

        if (pointIdx === -1 && arrowIdx === -1) {
            if (isRef) {
                const ref = this.getByRef(path)
                return ref ? [ref] : []
            } else {
                return this.mtag(path)
            }
        }

        if ((arrowIdx === -1) || (pointIdx !== -1 && pointIdx < arrowIdx)) {
            let next
            const str = path.substr(0, pointIdx)
            if (isRef) {
                const ref = this.getByRef(str)
                next = ref ? [ref] : []
            } else {
                next = this.mtag(str)
            }
            let total = []
            const subPath = path.substr(pointIdx + 1)
            for (let i = 0, n = next.length; i < n; i++) {
                total = total.concat(next[i]._selectDescs(subPath))
            }
            return total
        } else {
            let next
            const str = path.substr(0, arrowIdx)
            if (isRef) {
                const ref = this.getByRef(str)
                next = ref ? [ref] : []
            } else {
                next = this.mtag(str)
            }
            let total = []
            const subPath = path.substr(arrowIdx + 1)
            for (let i = 0, n = next.length; i < n; i++) {
                total = total.concat(next[i]._selectChilds(subPath))
            }
            return total
        }
    }

    _selectDescs(path) {
        const arrowIdx = path.indexOf(">")
        if (arrowIdx === -1) {
            // Use multi-tag path directly.
            return this.mtag(path)
        } else {
            const str = path.substr(0, arrowIdx)
            let next = this.mtag(str)

            let total = []
            const subPath = path.substr(arrowIdx + 1)
            for (let i = 0, n = next.length; i < n; i++) {
                total = total.concat(next[i]._selectChilds(subPath))
            }
            return total
        }
    }

    getByRef(ref) {
        return this.childList.getByRef(ref)
    }

    getLocationString() {
        let i;
        i = this.__parent ? this.__parent._children.getIndex(this) : "R";
        let localTags = this.getTags();
        let str = this.__parent ? this.__parent.getLocationString(): ""
        if (this.ref) {
            str += ":[" + i + "]" + this.ref
        } else if (localTags.length) {
            str += ":[" + i + "]" + localTags.join(",")
        } else {
            str += ":[" + i + "]#" + this.id
        }
        return str
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

        if (children) {
            let childStr = ""
            if (Utils.isObjectLiteral(children)) {
                let refs = Object.keys(children)
                childStr = ""
                for (let i = 0, n = refs.length; i < n; i++) {
                    childStr += `\n${indent}  "${refs[i]}":`
                    delete children[refs[i]].ref
                    childStr += View.getPrettyString(children[refs[i]], indent + "  ") + (i < n - 1 ? "," : "")
                }
                let isEmpty = (str === "{}");
                str = str.substr(0, str.length - 1) + (isEmpty ? "" : ",") + childStr + "\n" + indent + "}"
            } else {
                let n = children.length;
                childStr = "["
                for (let i = 0; i < n; i++) {
                    childStr += View.getPrettyString(children[i], indent + "  ") + (i < n - 1 ? "," : "") + "\n"
                }
                childStr += indent + "]}";
                let isEmpty = (str === "{}");
                str = str.substr(0, str.length - 1) + (isEmpty ? "" : ",") + "\"children\":\n" + indent + childStr + "}"
            }

        }

        return str;
    }

    getSettings() {
        let settings = this.getNonDefaults();

        let children = this._children.get();
        if (children) {
            let n = children.length;
            if (n) {
                const childArray = [];
                let missing = false
                for (let i = 0; i < n; i++) {
                    childArray.push(children[i].getSettings());
                    missing = missing || !children[i].ref
                }

                if (!missing) {
                    settings.children = {}
                    childArray.forEach(child => {
                        settings.children[child.ref] = child
                    })
                } else {
                    settings.children = childArray
                }
            }
        }

        settings.id = this.id;

        return settings;
    }

    getNonDefaults() {
        let settings = {};

        if (this.constructor !== View) {
            settings.type = this.constructor.name
        }

        if (this.__ref) {
            settings.ref = this.__ref
        }

        if (this.__tags && this.__tags.length) {
            settings.tags = this.__tags;
        }

        if (this.__x !== 0) settings.x = this.__x;
        if (this.__y !== 0) settings.y = this.__y;
        if (this.__w !== 0) settings.w = this.__w;
        if (this.__h !== 0) settings.h = this.__h;

        if (this.__scaleX === this.__scaleY) {
            if (this.__scaleX !== 1) settings.scale = this.__scaleX;
        } else {
            if (this.__scaleX !== 1) settings.scaleX = this.__scaleX;
            if (this.__scaleY !== 1) settings.scaleY = this.__scaleY;
        }

        if (this.__pivotX === this.__pivotY) {
            if (this.__pivotX !== 0.5) settings.pivot = this.__pivotX;
        } else {
            if (this.__pivotX !== 0.5) settings.pivotX = this.__pivotX;
            if (this.__pivotY !== 0.5) settings.pivotY = this.__pivotY;
        }

        if (this.__mountX === this.__mountY) {
            if (this.__mountX !== 0) settings.mount = this.__mountX;
        } else {
            if (this.__mountX !== 0) settings.mountX = this.__mountX;
            if (this.__mountY !== 0) settings.mountY = this.__mountY;
        }

        if (this.__alpha !== 1) settings.alpha = this.__alpha;

        if (this.__rotation !== 0) settings.rotation = this.__rotation;

        if (this.__core.colorUl === this.__core.colorUr && this.__core.colorBl === this.__core.colorBr && this.__core.colorUl === this.__core.colorBl) {
            if (this.__core.colorUl !== 0xFFFFFFFF) settings.color = this.__core.colorUl.toString(16);
        } else {
            if (this.__core.colorUl !== 0xFFFFFFFF) settings.colorUl = this.__core.colorUl.toString(16);
            if (this.__core.colorUr !== 0xFFFFFFFF) settings.colorUr = this.__core.colorUr.toString(16);
            if (this.__core.colorBl !== 0xFFFFFFFF) settings.colorBl = this.__core.colorBl.toString(16);
            if (this.__core.colorBr !== 0xFFFFFFFF) settings.colorBr = this.__core.colorBr.toString(16);
        }

        if (!this.__visible) settings.visible = false;

        if (this.__core.zIndex) settings.zIndex = this.__core.zIndex;

        if (this.__core.forceZIndexContext) settings.forceZIndexContext = true;

        if (this.__core.clipping) settings.clipping = this.__core.clipping;

        if (this.__core.clipbox) settings.clipbox = this.__core.clipbox;

        if (this.rect) {
            settings.rect = true;
        } else if (this.src) {
            settings.src = this.src;
        } else if (this.texture && this.__viewText) {
            settings.text = this.__viewText.settings.getNonDefaults();
        }

        if (this.__texture) {
            let tnd = this.__texture.getNonDefaults();
            if (Object.keys(tnd).length) {
                settings.texture = tnd;
            }
        }

        if (this._texturizer) {
            if (this.texturizer.enabled) {
                settings.renderToTexture = this.texturizer.enabled
            }
            if (this.texturizer.lazy) {
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

    get withinBoundsMargin() {
        return this.__core._withinBoundsMargin
    }

    _enableWithinBoundsMargin() {
        // Iff enabled, this toggles the active flag.
        if (this.__enabled) {
            this._setActiveFlag()

            if (this.__texture) {
                this.__texture.source.incWithinBoundsCount()
            }
        }
    }

    _disableWithinBoundsMargin() {
        // Iff active, this toggles the active flag.
        if (this.__active) {
            this._unsetActiveFlag()

            if (this.__texture) {
                this.__texture.source.decWithinBoundsCount()
            }
        }
    }

    set boundsMargin(v) {
        if (!Array.isArray(v) && v !== null && v !== undefined) {
            throw new Error("boundsMargin should be an array of top-right-bottom-left values, null (no margin) or undefined (inherit margin)")
        }
        this.__core.boundsMargin = v
    }

    get boundsMargin() {
        return this.__core.boundsMargin
    }

    get x() {
        return this.__x
    }

    set x(v) {
        if (this.__x !== v) {
            this._updateLocalTranslateDelta(v - this.__x, 0)
            this.__x = v
        }
    }

    get y() {
        return this.__y
    }

    set y(v) {
        if (this.__y !== v) {
            this._updateLocalTranslateDelta(0, v - this.__y)
            this.__y = v
        }
    }

    get w() {
        return this.__w
    }

    set w(v) {
        if (this.__w !== v) {
            this.__w = v
            this._updateDimensions()
        }
    }

    get h() {
        return this.__h
    }

    set h(v) {
        if (this.__h !== v) {
            this.__h = v
            this._updateDimensions()
        }
    }

    get scaleX() {
        return this.__scaleX
    }

    set scaleX(v) {
        if (this.__scaleX !== v) {
            this.__scaleX = v
            this._updateLocalTransform()
        }
    }

    get scaleY() {
        return this.__scaleY
    }

    set scaleY(v) {
        if (this.__scaleY !== v) {
            this.__scaleY = v
            this._updateLocalTransform()
        }
    }

    get scale() {
        return this.__scaleX
    }

    set scale(v) {
        if (this.__scaleX !== v || this.__scaleY !== v) {
            this.__scaleX = v
            this.__scaleY = v
            this._updateLocalTransform()
        }
    }

    get pivotX() {
        return this.__pivotX
    }

    set pivotX(v) {
        if (this.__pivotX !== v) {
            this.__pivotX = v
            this._updateLocalTranslate()
        }
    }

    get pivotY() {
        return this.__pivotY
    }

    set pivotY(v) {
        if (this.__pivotY !== v) {
            this.__pivotY = v
            this._updateLocalTranslate()
        }
    }

    get pivot() {
        return this.__pivotX
    }

    set pivot(v) {
        if (this.__pivotX !== v || this.__pivotY !== v) {
            this.__pivotX = v;
            this.__pivotY = v;
            this._updateLocalTranslate()
        }
    }

    get mountX() {
        return this.__mountX
    }

    set mountX(v) {
        if (this.__mountX !== v) {
            this.__mountX = v
            this._updateLocalTranslate()
        }
    }

    get mountY() {
        return this.__mountY
    }

    set mountY(v) {
        if (this.__mountY !== v) {
            this.__mountY = v
            this._updateLocalTranslate()
        }
    }

    get mount() {
        return this.__mountX
    }

    set mount(v) {
        if (this.__mountX !== v || this.__mountY !== v) {
            this.__mountX = v
            this.__mountY = v
            this._updateLocalTranslate()
        }
    }

    get alpha() {
        return this.__alpha
    }

    set alpha(v) {
        // Account for rounding errors.
        v = (v > 1 ? 1 : (v < 1e-14 ? 0 : v));
        if (this.__alpha !== v) {
            let prev = this.__alpha
            this.__alpha = v
            this._updateLocalAlpha();
            if ((prev === 0) !== (v === 0)) {
                this._updateEnabledFlag()
            }
        }
    }

    get rotation() {
        return this.__rotation
    }

    set rotation(v) {
        if (this.__rotation !== v) {
            this.__rotation = v
            this._updateLocalTransform()
        }
    }

    get colorUl() {
        return this.__core.colorUl
    }

    set colorUl(v) {
        this.__core.colorUl = v;
    }

    get colorUr() {
        return this.__core.colorUr
    }

    set colorUr(v) {
        this.__core.colorUr = v;
    }

    get colorBl() {
        return this.__core.colorBl
    }

    set colorBl(v) {
        this.__core.colorBl = v;
    }

    get colorBr() {
        return this.__core.colorBr
    }

    set colorBr(v) {
        this.__core.colorBr = v;
    }

    get color() {
        return this.__core.colorUl
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
        return this.__visible
    }

    set visible(v) {
        if (this.__visible !== v) {
            this.__visible = v
            this._updateLocalAlpha()
            this._updateEnabledFlag()
        }
    }

    get zIndex() {return this.__core.zIndex}
    set zIndex(v) {
        let prev = this.__core.zIndex;
        this.__core.zIndex = v;
    }

    get forceZIndexContext() {return this.__core.forceZIndexContext}
    set forceZIndexContext(v) {
        this.__core.forceZIndexContext = v;
    }

    get clipping() {return this.__core.clipping}
    set clipping(v) {
        this.__core.clipping = v;
    }

    get clipbox() {return this.__core.clipbox}
    set clipbox(v) {
        this.__core.clipbox = v;
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
        if (!this.__childList) {
            this.__childList = new ViewChildList(this, false)
        }
        return this.__childList
    }

    get childList() {
        if (!this._allowChildrenAccess()) {
            this._throwError("Direct access to children is not allowed in " + this.getLocationString())
        }
        return this._children
    }

    hasChildren() {
        return this.__childList && (this.__childList.length > 0)
    }

    _allowChildrenAccess() {
        return true
    }

    get children() {
        return this.childList.get()
    }

    set children(children) {
        this.childList.patch(children)
    }

    add(o) {
        return this.childList.a(o);
    }

    get parent() {
        return this.__parent;
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

    set mw(v) {
        if (this.texture) {
            this.texture.source.mw = v
        } else {
            this._throwError('Please set mw after setting a texture.')
        }
    }

    set mh(v) {
        if (this.texture) {
            this.texture.source.mh = v
        } else {
            this._throwError('Please set mh after setting a texture.')
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
        if (!this.__viewText) {
            this.__viewText = new ViewText(this);
        }

        // Give direct access to the settings.
        return this.__viewText.settings;
    }

    set text(v) {
        if (!this.__viewText) {
            this.__viewText = new ViewText(this);
        }
        if (Utils.isString(v)) {
            this.__viewText.settings.text = v;
        } else {
            this.__viewText.settings.patch(v);
        }
    }

    set onUpdate(f) {
        this.__core.onUpdate = f;
    }

    set onAfterUpdate(f) {
        this.__core.onAfterUpdate = f;
    }

    get shader() {
        return this.__core.shader;
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
                Base.patchObject(shader, v)
            }
        } else if (v === null) {
            shader = this.stage.ctx.renderState.defaultShader;
        } else if (v === undefined) {
            shader = null;
        } else {
            if (v.isShader) {
                shader = v;
            } else {
                console.error("Please specify a shader type.");
                return
            }
        }

        if (this.__enabled && this.__core.shader) {
            this.__core.shader.removeView(this);
        }

        this.__core.shader = shader;

        if (this.__enabled && this.__core.shader) {
            this.__core.shader.addView(this);
        }
    }

    _hasTexturizer() {
        return !!this.__core._texturizer
    }

    get renderToTexture() {
        return this._hasTexturizer() && this.texturizer.enabled
    }

    set renderToTexture(v) {
        this.texturizer.enabled = v
    }

    get renderToTextureLazy() {
        return this._hasTexturizer() && this.texturizer.lazy
    }

    set renderToTextureLazy(v) {
        this.texturizer.lazy = v
    }

    get hideResultTexture() {
        return this._hasTexturizer() && this.texturizer.hideResult
    }

    set hideResultTexture(v) {
        this.texturizer.hideResult = v
    }

    get colorizeResultTexture() {
        return this._hasTexturizer() && this.texturizer.colorize
    }

    set colorizeResultTexture(v) {
        this.texturizer.colorize = v
    }

    get filters() {
        return this._hasTexturizer() && this.texturizer.filters
    }

    set filters(v) {
        if (this.__enabled) {
            this.texturizer.filters.forEach(filter => filter.removeView(this.__core))
        }

        this.texturizer.filters = v

        if (this.__enabled) {
            this.texturizer.filters.forEach(filter => filter.addView(this.__core))
        }
    }

    getTexture() {
        return this.texturizer._getTextureSource()
    }

    get texturizer() {
        return this.__core.texturizer
    }

    patch(settings, createMode = false) {
        let paths = Object.keys(settings)

        if (settings.hasOwnProperty("__create")) {
            createMode = settings["__create"]
        }

        for (let i = 0, n = paths.length; i < n; i++) {
            let path = paths[i]
            const v = settings[path]

            let pointIdx = path.indexOf(".")
            let arrowIdx = path.indexOf(">")
            if (arrowIdx === -1 && pointIdx === -1) {
                const firstCharCode = path.charCodeAt(0)
                if (Utils.isUcChar(firstCharCode)) {
                    // Ref.
                    const child = this.getByRef(path)
                    if (!child) {
                        if (v !== undefined) {
                            let subCreateMode = createMode
                            if (Utils.isObjectLiteral(v)) {
                                if (v.hasOwnProperty("__create")) {
                                    subCreateMode = v.__create
                                }
                            }

                            if (subCreateMode === null) {
                                // Ignore.
                            } else if (subCreateMode === true) {
                                // Add to list immediately.
                                let c
                                if (Utils.isObjectLiteral(v)) {
                                    // Catch this case to capture createMode flag.
                                    c = this.childList.createItem(v);
                                    c.patch(v, subCreateMode);
                                } else if (Utils.isObject(v)) {
                                    c = v
                                }
                                if (c.isView) {
                                    c.ref = path
                                }

                                this.childList.a(c)
                            } else {
                                this._throwError("Can't find path: " + path)
                            }
                        }
                    } else {
                        if (v === undefined) {
                            if (child.parent) {
                                child.parent.childList.remove(child)
                            }
                        } else if (Utils.isObjectLiteral(v)) {
                            child.patch(v, createMode)
                        } else if (v.isView) {
                            // Replace view by new view.
                            v.ref = path
                            this.childList.replace(v, child)
                        } else {
                            this._throwError("Unexpected value for path: " + path)
                        }
                    }
                } else {
                    // Property.
                    Base.patchObjectProperty(this, path, v)
                }
            } else {
                // Select path.
                const views = this.select(path)
                if (v === undefined) {
                    for (let i = 0, n = views.length; i < n; i++) {
                        if (views[i].parent) {
                            views[i].parent.childList.remove(views[i])
                        }
                    }
                } else if (Utils.isObjectLiteral(v)) {
                    // Recursive path.
                    for (let i = 0, n = views.length; i < n; i++) {
                        views[i].patch(v, createMode)
                    }
                } else {
                    this._throwError("Unexpected value for path: " + path)
                }
            }
        }
    }

    _throwError(message) {
        throw new Error(this.constructor.name + " (" + this.getLocationString() + "): " + message)
    }


    animation(settings) {
        return this.stage.animations.createAnimation(this, settings);
    }

    transition(property, settings) {
        if (settings === undefined) {
            return this._getTransition(property);
        } else {
            this._setTransition(property, settings);
            // We do not create/return the transition, because it would undo the 'lazy transition creation' optimization.
            return null;
        }
    }

    set transitions(object) {
        let keys = Object.keys(object);
        keys.forEach(property => {
            this.transition(property, object[property]);
        });
    }

    set smooth(object) {
        let keys = Object.keys(object);
        keys.forEach(property => {
            let value = object[property]
            if (Array.isArray(value)) {
                this.setSmooth(property, value[0], value[1])
            } else {
                this.setSmooth(property, value)
            }
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
        } else {
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
    }

    _removeTransition(property) {
        if (this._transitions) {
            delete this._transitions[property];
        }
    }

    getSmooth(property, v) {
        let t = this._getTransition(property);
        if (t && t.isAttached()) {
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

    static isColorProperty(property) {
        return property.startsWith("color")
    }

    static getMerger(property) {
        if (View.isColorProperty(property)) {
            return StageUtils.mergeColors
        } else {
            return StageUtils.mergeNumbers
        }
    }
}


View.prototype.isView = 1;

View.id = 1;

// Getters reused when referencing view (subobject) properties by a property path, as used in a transition or animation ('x', 'texture.x', etc).
View.PROP_GETTERS = new Map();

// Setters reused when referencing view (subobject) properties by a property path, as used in a transition or animation ('x', 'texture.x', etc).
View.PROP_SETTERS = new Map();

module.exports = View;

let ViewText = require('./ViewText');
let Texture = require('./Texture');
let TextureSource = require('./TextureSource')
let Transition = require('../animation/Transition')
let TransitionSettings = require('../animation/TransitionSettings')
let ViewChildList = require('./ViewChildList');
