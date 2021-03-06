/**
 * Copyright Metrological, 2017
 */
let Utils = require('./Utils');
/*M¬*/let EventEmitter = require(Utils.isNode ? 'events' : '../browser/EventEmitter');/*¬M*/

class TextRendererSettings extends EventEmitter {

    /**
     * Finalize this settings object so that it is no longer dependent on possibly changing defaults.
     */
    finalize(view) {
        // Inherit width and height from component.
        if (!this.w && view.w) {
            this.w = view.w;
        }

        if (!this.h && view.h) {
            this.h = view.h;
        }

        if (this.fontFace === null) {
            this.fontFace = view.stage.getOption('defaultFontFace');
        }

        if (this.precision === null) {
            this.precision = view.stage.getRenderPrecision();
        }
    };

    getTextureId() {
        let parts = [];

        if (this.w !== 0) parts.push("w " + this.w);
        if (this.h !== 0) parts.push("h " + this.h);
        if (this.fontStyle !== "normal") parts.push("fS" + this.fontStyle);
        if (this.fontSize !== 40) parts.push("fs" + this.fontSize);
        if (this.fontFace !== null) parts.push("ff" + (Array.isArray(this.fontFace) ? this.fontFace.join(",") : this.fontFace));
        if (this.wordWrap !== true) parts.push("wr" + (this.wordWrap ? 1 : 0));
        if (this.wordWrapWidth !== 0) parts.push("ww" + this.wordWrapWidth);
        if (this.lineHeight !== null) parts.push("lh" + this.lineHeight);
        if (this.textBaseline !== "alphabetic") parts.push("tb" + this.textBaseline);
        if (this.textAlign !== "left") parts.push("ta" + this.textAlign);
        if (this.offsetY !== null) parts.push("oy" + this.offsetY);
        if (this.maxLines !== 0) parts.push("ml" + this.maxLines);
        if (this.maxLinesSuffix !== "..") parts.push("ms" + this.maxLinesSuffix);
        if (this.precision !== null) parts.push("pc" + this.precision);
        if (this.textColor !== 0xffffffff) parts.push("co" + this.textColor.toString(16));
        if (this.paddingLeft !== 0) parts.push("pl" + this.paddingLeft);
        if (this.paddingRight !== 0) parts.push("pr" + this.paddingRight);
        if (this.shadow !== false) parts.push("sh" + (this.shadow ? 1 : 0));
        if (this.shadowColor !== 0xff000000) parts.push("sc" + this.shadowColor.toString(16));
        if (this.shadowOffsetX !== 0) parts.push("sx" + this.shadowOffsetX);
        if (this.shadowOffsetY !== 0) parts.push("sy" + this.shadowOffsetY);
        if (this.shadowBlur !== 5) parts.push("sb" + this.shadowBlur);
        if (this.highlight !== false) parts.push("hL" + (this.highlight ? 1 : 0));
        if (this.highlightHeight !== 0) parts.push("hh" + this.highlightHeight);
        if (this.highlightColor !== 0xff000000) parts.push("hc" + this.highlightColor.toString(16));
        if (this.highlightOffset !== null) parts.push("ho" + this.highlightOffset);
        if (this.highlightPaddingLeft !== null) parts.push("hl" + this.highlightPaddingLeft);
        if (this.highlightPaddingRight !== null) parts.push("hr" + this.highlightPaddingRight);

        if (this.cutSx) parts.push("csx" + this.cutSx);
        if (this.cutEx) parts.push("cex" + this.cutEx);
        if (this.cutSy) parts.push("csy" + this.cutSy);
        if (this.cutEy) parts.push("cey" + this.cutEy);

        if (this.sync) parts.push("sync");

        let id = "TX$" + parts.join("|") + ":" + this.text;
        return id;
    }

    getNonDefaults() {
        var nonDefaults = {};

        if (this.text !== "") nonDefaults['text'] = this.text;
        if (this.w !== 0) nonDefaults['w'] = this.w;
        if (this.h !== 0) nonDefaults['h'] = this.h;
        if (this.fontStyle !== "normal") nonDefaults['fontStyle'] = this.fontStyle;
        if (this.fontSize !== 40) nonDefaults["fontSize"] = this.fontSize;
        if (this.fontFace !== null) nonDefaults["fontFace"] = this.fontFace;
        if (this.wordWrap !== true) nonDefaults["wordWrap"] = this.wordWrap;
        if (this.wordWrapWidth !== 0) nonDefaults["wordWrapWidth"] = this.wordWrapWidth;
        if (this.lineHeight !== null) nonDefaults["lineHeight"] = this.lineHeight;
        if (this.textBaseline !== "alphabetic") nonDefaults["textBaseline"] = this.textBaseline;
        if (this.textAlign !== "left") nonDefaults["textAlign"] = this.textAlign;
        if (this.offsetY !== null) nonDefaults["offsetY"] = this.offsetY;
        if (this.maxLines !== 0) nonDefaults["maxLines"] = this.maxLines;
        if (this.maxLinesSuffix !== "..") nonDefaults["maxLinesSuffix"] = this.maxLinesSuffix;
        if (this.precision !== null) nonDefaults["precision"] = this.precision;
        if (this.textColor !== 0xffffffff) nonDefaults["textColor"] = this.textColor;
        if (this.paddingLeft !== 0) nonDefaults["paddingLeft"] = this.paddingLeft;
        if (this.paddingRight !== 0) nonDefaults["paddingRight"] = this.paddingRight;
        if (this.shadow !== false) nonDefaults["shadow"] = this.shadow;
        if (this.shadowColor !== 0xff000000) nonDefaults["shadowColor"] = this.shadowColor;
        if (this.shadowOffsetX !== 0) nonDefaults["shadowOffsetX"] = this.shadowOffsetX;
        if (this.shadowOffsetY !== 0) nonDefaults["shadowOffsetY"] = this.shadowOffsetY;
        if (this.shadowBlur !== 5) nonDefaults["shadowBlur"] = this.shadowBlur;
        if (this.highlight !== false) nonDefaults["highlight"] = this.highlight;
        if (this.highlightHeight !== 0) nonDefaults["highlightHeight"] = this.highlightHeight;
        if (this.highlightColor !== 0xff000000) nonDefaults["highlightColor"] = this.highlightColor;
        if (this.highlightOffset !== 0) nonDefaults["highlightOffset"] = this.highlightOffset;
        if (this.highlightPaddingLeft !== 0) nonDefaults["highlightPaddingLeft"] = this.highlightPaddingLeft;
        if (this.highlightPaddingRight !== 0) nonDefaults["highlightPaddingRight"] = this.highlightPaddingRight;

        if (this.cutSx) nonDefaults["cutSx"] = this.cutSx;
        if (this.cutEx) nonDefaults["cutEx"] = this.cutEx;
        if (this.cutSy) nonDefaults["cutSy"] = this.cutSy;
        if (this.cutEy) nonDefaults["cutEy"] = this.cutEy;

        if (this.sync) nonDefaults["sync"] = this.sync;

        return nonDefaults;
    }

    clone() {
        let obj = new TextRendererSettings();
        obj._text = this._text;
        obj._w = this._w;
        obj._h = this._h;
        obj._fontStyle = this._fontStyle;
        obj._fontSize = this._fontSize;
        obj._fontFace = this._fontFace;
        obj._wordWrap = this._wordWrap;
        obj._wordWrapWidth = this._wordWrapWidth;
        obj._lineHeight = this._lineHeight;
        obj._textBaseline = this._textBaseline;
        obj._textAlign = this._textAlign;
        obj._offsetY = this._offsetY;
        obj._maxLines = this._maxLines;
        obj._maxLinesSuffix = this._maxLinesSuffix;
        obj._precision = this._precision;
        obj._textColor = this._textColor;
        obj._paddingLeft = this._paddingLeft;
        obj._paddingRight = this._paddingRight;
        obj._shadow = this._shadow;
        obj._shadowColor = this._shadowColor;
        obj._shadowOffsetX = this._shadowOffsetX;
        obj._shadowOffsetY = this._shadowOffsetY;
        obj._shadowBlur = this._shadowBlur;
        obj._highlight = this._highlight;
        obj._highlightHeight = this._highlightHeight;
        obj._highlightColor = this._highlightColor;
        obj._highlightOffset = this._highlightOffset;
        obj._highlightPaddingLeft = this._highlightPaddingLeft;
        obj._highlightPaddingRight = this._highlightPaddingRight;
        obj._cutSx = this._cutSx;
        obj._cutEx = this._cutEx;
        obj._cutSy = this._cutSy;
        obj._cutEy = this._cutEy;
        obj.sync = this.sync;
        return obj;
    }

    patch(settings) {
        Base.patchObject(this, settings)
    }

    get text() {
        return this._text
    }

    set text(v) {
        if (this._text !== v) {
            this._text = v;
            this.emit('change');
        }
    }

    get w() {
        return this._w
    }

    set w(v) {
        if (this._w !== v) {
            this._w = v;
            this.emit('change');
        }
    }

    get h() {
        return this._h
    }

    set h(v) {
        if (this._h !== v) {
            this._h = v;
            this.emit('change');
        }
    }

    get fontStyle() {
        return this._fontStyle
    }

    set fontStyle(v) {
        if (this._fontStyle !== v) {
            this._fontStyle = v;
            this.emit('change');
        }
    }

    get fontSize() {
        return this._fontSize
    }

    set fontSize(v) {
        if (this._fontSize !== v) {
            this._fontSize = v;
            this.emit('change');
        }
    }

    get fontFace() {
        return this._fontFace
    }

    set fontFace(v) {
        if (this._fontFace !== v) {
            this._fontFace = v;
            this.emit('change');
        }
    }

    get wordWrap() {
        return this._wordWrap
    }

    set wordWrap(v) {
        if (this._wordWrap !== v) {
            this._wordWrap = v;
            this.emit('change');
        }
    }

    get wordWrapWidth() {
        return this._wordWrapWidth
    }

    set wordWrapWidth(v) {
        if (this._wordWrapWidth !== v) {
            this._wordWrapWidth = v;
            this.emit('change');
        }
    }

    get lineHeight() {
        return this._lineHeight
    }

    set lineHeight(v) {
        if (this._lineHeight !== v) {
            this._lineHeight = v;
            this.emit('change');
        }
    }

    get textBaseline() {
        return this._textBaseline
    }

    set textBaseline(v) {
        if (this._textBaseline !== v) {
            this._textBaseline = v;
            this.emit('change');
        }
    }

    get textAlign() {
        return this._textAlign
    }

    set textAlign(v) {
        if (this._textAlign !== v) {
            this._textAlign = v;
            this.emit('change');
        }
    }

    get offsetY() {
        return this._offsetY
    }

    set offsetY(v) {
        if (this._offsetY !== v) {
            this._offsetY = v;
            this.emit('change');
        }
    }

    get maxLines() {
        return this._maxLines
    }

    set maxLines(v) {
        if (this._maxLines !== v) {
            this._maxLines = v;
            this.emit('change');
        }
    }

    get maxLinesSuffix() {
        return this._maxLinesSuffix
    }

    set maxLinesSuffix(v) {
        if (this._maxLinesSuffix !== v) {
            this._maxLinesSuffix = v;
            this.emit('change');
        }
    }

    get precision() {
        return this._precision
    }

    set precision(v) {
        if (this._precision !== v) {
            this._precision = v;
            this.emit('change');
        }
    }

    get textColor() {
        return this._textColor
    }

    set textColor(v) {
        if (this._textColor !== v) {
            this._textColor = v;
            this.emit('change');
        }
    }

    get paddingLeft() {
        return this._paddingLeft
    }

    set paddingLeft(v) {
        if (this._paddingLeft !== v) {
            this._paddingLeft = v;
            this.emit('change');
        }
    }

    get paddingRight() {
        return this._paddingRight
    }

    set paddingRight(v) {
        if (this._paddingRight !== v) {
            this._paddingRight = v;
            this.emit('change');
        }
    }

    get shadow() {
        return this._shadow
    }

    set shadow(v) {
        if (this._shadow !== v) {
            this._shadow = v;
            this.emit('change');
        }
    }

    get shadowColor() {
        return this._shadowColor
    }

    set shadowColor(v) {
        if (this._shadowColor !== v) {
            this._shadowColor = v;
            this.emit('change');
        }
    }

    get shadowOffsetX() {
        return this._shadowOffsetX
    }

    set shadowOffsetX(v) {
        if (this._shadowOffsetX !== v) {
            this._shadowOffsetX = v;
            this.emit('change');
        }
    }

    get shadowOffsetY() {
        return this._shadowOffsetY
    }

    set shadowOffsetY(v) {
        if (this._shadowOffsetY !== v) {
            this._shadowOffsetY = v;
            this.emit('change');
        }
    }

    get shadowBlur() {
        return this._shadowBlur
    }

    set shadowBlur(v) {
        if (this._shadowBlur !== v) {
            this._shadowBlur = v;
            this.emit('change');
        }
    }

    get highlight() {
        return this._highlight
    }

    set highlight(v) {
        if (this._highlight !== v) {
            this._highlight = v;
            this.emit('change');
        }
    }

    get highlightHeight() {
        return this._highlightHeight
    }

    set highlightHeight(v) {
        if (this._highlightHeight !== v) {
            this._highlightHeight = v;
            this.emit('change');
        }
    }

    get highlightColor() {
        return this._highlightColor
    }

    set highlightColor(v) {
        if (this._highlightColor !== v) {
            this._highlightColor = v;
            this.emit('change');
        }
    }

    get highlightOffset() {
        return this._highlightOffset
    }

    set highlightOffset(v) {
        if (this._highlightOffset !== v) {
            this._highlightOffset = v;
            this.emit('change');
        }
    }

    get highlightPaddingLeft() {
        return this._highlightPaddingLeft
    }

    set highlightPaddingLeft(v) {
        if (this._highlightPaddingLeft !== v) {
            this._highlightPaddingLeft = v;
            this.emit('change');
        }
    }

    get highlightPaddingRight() {
        return this._highlightPaddingRight
    }

    set highlightPaddingRight(v) {
        if (this._highlightPaddingRight !== v) {
            this._highlightPaddingRight = v;
            this.emit('change');
        }
    }

    get cutSx() {
        return this._cutSx
    }

    set cutSx(v) {
        if (this._cutSx !== v) {
            this._cutSx = v;
            this.emit('change');
        }
    }

    get cutEx() {
        return this._cutEx
    }

    set cutEx(v) {
        if (this._cutEx !== v) {
            this._cutEx = v;
            this.emit('change');
        }
    }

    get cutSy() {
        return this._cutSy
    }

    set cutSy(v) {
        if (this._cutSy !== v) {
            this._cutSy = v;
            this.emit('change');
        }
    }

    get cutEy() {
        return this._cutEy
    }

    set cutEy(v) {
        if (this._cutEy !== v) {
            this._cutEy = v;
            this.emit('change');
        }
    }
}

// Because there are so many properties, we prefer to use the prototype for default values.
// This causes a decrease in performance, but also a decrease in memory usage.
let proto = TextRendererSettings.prototype
proto._text = "";
proto._w = 0;
proto._h = 0;
proto._fontStyle = "normal";
proto._fontSize = 40;
proto._fontFace = null;
proto._wordWrap = true;
proto._wordWrapWidth = 0;
proto._lineHeight = null;
proto._textBaseline = "alphabetic";
proto._textAlign = "left";
proto._offsetY = null;
proto._maxLines = 0;
proto._maxLinesSuffix = "..";
proto._precision = null;
proto._textColor = 0xFFFFFFFF;
proto._paddingLeft = 0;
proto._paddingRight = 0;
proto._shadow = false;
proto._shadowColor = 0xFF000000;
proto._shadowOffsetX = 0;
proto._shadowOffsetY = 0;
proto._shadowBlur = 5;
proto._highlight = false;
proto._highlightHeight = 0;
proto._highlightColor = 0xFF000000;
proto._highlightOffset = 0;
proto._highlightPaddingLeft = 0;
proto._highlightPaddingRight = 0;
proto._cutSx = 0;
proto._cutEx = 0;
proto._cutSy = 0;
proto._cutEy = 0;
proto.sync = false;

module.exports = TextRendererSettings;

let Base = require('./Base')
