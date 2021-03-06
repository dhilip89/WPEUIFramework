/**
 * Copyright Metrological, 2017
 */

class ViewTexturizer {

    constructor(viewCore) {

        this._view = viewCore.view
        this._core = viewCore

        this.ctx = this._core.ctx

        this._enabled = false
        this.lazy = false
        this._colorize = false

        this._filters = []

        this._renderTexture = null

        this._renderTextureReused = false

        this._resultTexture = null

        this._resultTextureSource = null

        this._renderToTextureEnabled = false

        this._hideResult = false

        this.filterResultCached = false

        this.empty = false
    }

    get enabled() {
        return this._enabled
    }

    set enabled(v) {
        this._enabled = v
        this._core.updateRenderToTextureEnabled()
    }

    get hideResult() {
        return this._hideResult
    }

    set hideResult(v) {
        this._hideResult = v
        this._core.setHasRenderUpdates(1);
    }

    get colorize() {
        return this._colorize
    }

    set colorize(v) {
        if (this._colorize !== v) {
            this._colorize = v

            // Only affects the finally drawn quad.
            this._core.setHasRenderUpdates(1)
        }
    }

    get filters() {
        return this._filters
    }

    set filters(v) {
        this._clearFilters();
        v.forEach(filter => {
            if (Utils.isObjectLiteral(filter) && filter.type) {
                let s = new filter.type(this.ctx)
                s.patch(filter)
                filter = s
            }

            if (filter.isFilter) {
                this._addFilter(filter);
            } else {
                console.error("Please specify a filter type.");
            }
        })

        this._core.updateRenderToTextureEnabled();
        this._core.setHasRenderUpdates(2);
    }

    _clearFilters() {
        this._filters = []
        this.filterResultCached = false
    }

    _addFilter(filter) {
        this._filters.push(filter);
    }

    _hasFilters() {
        return (this._filters.length > 0);
    }

    _hasActiveFilters() {
        for (let i = 0, n = this._filters.length; i < n; i++) {
            if (!this._filters[i].useDefault()) return true
        }
        return false
    }

    getActiveFilters() {
        let activeFilters = []
        this._filters.forEach(filter => {
            if (!filter.useDefault()) {
                if (filter.getFilters) {
                    filter.getFilters().forEach(f => activeFilters.push(f))
                } else {
                    activeFilters.push(filter)
                }
            }
        })
        return activeFilters
    }

    getTexture() {
        return this.ctx.stage.texture(this._getTextureSource(), {precision: this._getTextureSource().precision});
    }

    _getTextureSource() {
        if (!this._resultTextureSource) {
            this._resultTextureSource = new TextureSource(this._view.stage.textureManager, null);

            this.updateResultTexture()
        }
        return this._resultTextureSource
    }

    updateResultTexture() {
        let resultTexture = this.getResultTexture()
        if (this._resultTextureSource) {
            if (this._resultTextureSource.glTexture !== resultTexture) {
                let w = resultTexture ? resultTexture.w : 0
                let h = resultTexture ? resultTexture.h : 0
                this._resultTextureSource._changeGlTexture(resultTexture, w, h)
            }

            // Texture will be updated: all views using the source need to be updated as well.
            this._resultTextureSource.views.forEach(view => {
                view._updateDimensions()
                view.core.setHasRenderUpdates(3)
            })
        }
    }

    mustRenderToTexture() {
        // Check if we must really render as texture.
        if (this._enabled && !this.lazy) {
            return true
        } else if (this._enabled && this.lazy && this._core._hasRenderUpdates < 3) {
            // Static-only: if renderToTexture did not need to update during last drawn frame, generate it as a cache.
            return true
        } else if (this._hasActiveFilters()) {
            // Only render as texture if there is at least one filter shader to be applied.
            return true
        }
        return false
    }

    deactivate() {
        this.release()
    }

    get renderTextureReused() {
        return this._renderTextureReused
    }

    release() {
        this.releaseRenderTexture()
        this.releaseFilterTexture()
    }

    releaseRenderTexture() {
        if (this._renderTexture) {
            if (!this._renderTextureReused) {
                this.ctx.releaseRenderTexture(this._renderTexture)
            }
            this._renderTexture = null
            this._renderTextureReused = false
            this.updateResultTexture()
        }
    }

    // Reuses the specified texture as the render texture.
    reuseTextureAsRenderTexture(glTexture) {
        if (this._renderTexture !== glTexture) {
            this.releaseRenderTexture()
            this._renderTexture = glTexture
            this._renderTextureReused = true
        }
    }

    hasRenderTexture() {
        return !!this._renderTexture
    }

    getRenderTexture() {
        if (!this._renderTexture) {
            this._renderTexture = this.ctx.allocateRenderTexture(this._core._rw, this._core._rh);
            this._renderTextureReused = false
        }
        return this._renderTexture;
    }

    getFilterTexture() {
        if (!this._resultTexture) {
            this._resultTexture = this.ctx.allocateRenderTexture(this._core._rw, this._core._rh);
        }
        return this._resultTexture;
    }

    releaseFilterTexture() {
        if (this._resultTexture) {
            this.ctx.releaseRenderTexture(this._resultTexture)
            this._resultTexture = null
            this.filterResultCached = false
            this.updateResultTexture()
        }
    }

    getResultTexture() {
        return this._hasActiveFilters() ? this._resultTexture : this._renderTexture
    }

}

let Utils = require('../Utils')
let TextureSource = require('../TextureSource')

module.exports = ViewTexturizer