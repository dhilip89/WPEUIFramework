class WasmView {

    constructor(wasm, vi) {
        // Update pointers to mimic C struct.
        let mem = wasm.getMemory()
        let base = wasm._getViewStructMemoryOffset(vi)
        this.fptr = new Float32Array(mem, base);
        this.uptr = new Uint32Array(mem, base);
    }

    get parent() {
        return this.uptr[0]
    }

    set parent(v) {
        this.uptr[0] = v
    }

    get hasUpdates() {
        return this.uptr[1]
    }

    set hasUpdates(v) {
        this.uptr[1] = v
    }

    get hasRenderUpdates() {
        return this.uptr[2]
    }

    set hasRenderUpdates(v) {
        this.uptr[2] = v
    }

    get hasVisitEntry() {
        return this.uptr[3]
    }

    set hasVisitEntry(v) {
        this.uptr[3] = v
    }

    get hasVisitExit() {
        return this.uptr[4]
    }

    set hasVisitExit(v) {
        this.uptr[4] = v
    }

    get recalc() {
        return this.uptr[5]
    }

    set recalc(v) {
        this.uptr[5] = v
    }

    get updateTreeOrder() {
        return this.uptr[6]
    }

    set updateTreeOrder(v) {
        this.uptr[6] = v
    }

    get w() {
        return this.fptr[7]
    }

    set w(v) {
        this.fptr[7] = v
    }

    get h() {
        return this.fptr[8]
    }

    set h(v) {
        this.fptr[8] = v
    }

    get al() {
        return this.fptr[9]
    }

    set al(v) {
        this.fptr[9] = v
    }

    get x() {
        return this.fptr[10]
    }

    set x(v) {
        this.fptr[10] = v
    }

    get y() {
        return this.fptr[11]
    }

    set y(v) {
        this.fptr[11] = v
    }

    get a() {
        return this.fptr[12]
    }

    set a(v) {
        this.fptr[12] = v
    }

    get b() {
        return this.fptr[13]
    }

    set b(v) {
        this.fptr[13] = v
    }

    get c() {
        return this.fptr[14]
    }

    set c(v) {
        this.fptr[14] = v
    }

    get d() {
        return this.fptr[15]
    }

    set d(v) {
        this.fptr[15] = v
    }

    get wal() {
        return this.fptr[16]
    }

    set wal(v) {
        this.fptr[16] = v
    }

    get wx() {
        return this.fptr[17]
    }

    set wx(v) {
        this.fptr[17] = v
    }

    get wy() {
        return this.fptr[18]
    }

    set wy(v) {
        this.fptr[18] = v
    }

    get wa() {
        return this.fptr[19]
    }

    set wa(v) {
        this.fptr[19] = v
    }

    get wb() {
        return this.fptr[20]
    }

    set wb(v) {
        this.fptr[20] = v
    }

    get wc() {
        return this.fptr[21]
    }

    set wc(v) {
        this.fptr[21] = v
    }

    get wd() {
        return this.fptr[22]
    }

    set wd(v) {
        this.fptr[22] = v
    }

    get hr() {
        return this.fptr[23]
    }

    set hr(v) {
        this.fptr[23] = v
    }

    get ral() {
        return this.fptr[24]
    }

    set ral(v) {
        this.fptr[24] = v
    }

    get rx() {
        return this.fptr[25]
    }

    set rx(v) {
        this.fptr[25] = v
    }

    get ry() {
        return this.fptr[26]
    }

    set ry(v) {
        this.fptr[26] = v
    }

    get ra() {
        return this.fptr[27]
    }

    set ra(v) {
        this.fptr[27] = v
    }

    get rb() {
        return this.fptr[28]
    }

    set rb(v) {
        this.fptr[28] = v
    }

    get rc() {
        return this.fptr[29]
    }

    set rc(v) {
        this.fptr[29] = v
    }

    get rd() {
        return this.fptr[30]
    }

    set rd(v) {
        this.fptr[30] = v
    }

    get clipping() {
        return this.uptr[31]
    }

    set clipping(v) {
        this.uptr[31] = v
    }

    get hasTexture() {
        return this.uptr[32]
    }

    set hasTexture(v) {
        this.uptr[32] = v
    }

    get colorUl() {
        return this.uptr[33]
    }

    set colorUl(v) {
        this.uptr[33] = v
    }

    get colorUr() {
        return this.uptr[34]
    }

    set colorUr(v) {
        this.uptr[34] = v
    }

    get colorBr() {
        return this.uptr[35]
    }

    set colorBr(v) {
        this.uptr[35] = v
    }

    get colorBl() {
        return this.uptr[36]
    }

    set colorBl(v) {
        this.uptr[36] = v
    }

    get ulx() {
        return this.fptr[37]
    }

    set ulx(v) {
        this.fptr[37] = v
    }

    get uly() {
        return this.fptr[38]
    }

    set uly(v) {
        this.fptr[38] = v
    }

    get brx() {
        return this.fptr[39]
    }

    set brx(v) {
        this.fptr[39] = v
    }

    get bry() {
        return this.fptr[40]
    }

    set bry(v) {
        this.fptr[40] = v
    }

    get zIndex() {
        return this.fptr[41]
    }

    set zIndex(v) {
        this.fptr[41] = v
    }

    get forceZIndexContext() {
        return this.uptr[42]
    }

    set forceZIndexContext(v) {
        this.uptr[42] = v
    }

    get zContextUsage() {
        return this.uptr[43]
    }

    set zContextUsage(v) {
        this.uptr[43] = v
    }

    get zParent() {
        return this.uptr[44]
    }

    set zParent(v) {
        this.uptr[44] = v
    }

    get zSort() {
        return this.uptr[45]
    }

    set zSort(v) {
        this.uptr[45] = v
    }

    get children() {
        return this.uptr[46]
    }

    set children(v) {
        this.uptr[46] = v
    }

    get _children() {
        return this.uptr[47]
    }

    set _children(v) {
        this.uptr[47] = v
    }

    get zIndexedChildren() {
        return this.uptr[48]
    }

    set zIndexedChildren(v) {
        this.uptr[48] = v
    }

    get _zIndexedChildren() {
        return this.uptr[49]
    }

    set _zIndexedChildren(v) {
        this.uptr[49] = v
    }

    get hasShader() {
        return this.uptr[50]
    }

    set hasShader(v) {
        this.uptr[50] = v
    }

    get renderToTextureEnabled() {
        return this.uptr[51]
    }

    set renderToTextureEnabled(v) {
        this.uptr[51] = v
    }

    get useRenderToTexture() {
        return this.uptr[52]
    }

    set useRenderToTexture(v) {
        this.uptr[52] = v
    }

    get useViewportClipping() {
        return this.uptr[53]
    }

    set useViewportClipping(v) {
        this.uptr[53] = v
    }

    get colorizeResultTexture() {
        return this.uptr[54]
    }

    set colorizeResultTexture(v) {
        this.uptr[54] = v
    }
}

module.exports = WasmView;