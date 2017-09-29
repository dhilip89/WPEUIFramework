/**
 *
 */
var start = function(wpe) {

    wpe = wpe || {};

    with(wpe) {
        var options = {w: 900, h: 900, glClearColor: 0xFF000000, useTextureAtlas: false, debugTextureAtlas: false};

        // Nodejs-specific options.
        if (Utils.isNode) {
            options.window = {title: "Usage example", fullscreen: false};
            options.supercharger = {localImagePath: __dirname};
        }

        var stage = new Stage(options);

        if (!Utils.isNode) {
            document.body.appendChild(stage.getCanvas());
            window.stage = stage;
        }

        stage.root.add([{rect: true, w: 900, h: 900, colorLeft: 0xFF000000, colorRight: 0xFF0000FF, children: [
            {tag: 't1', rect: true, color: 0xFFFF0000, w: 450, h: 300, x: 300, y: 300},
            {tag: 't2', rect: true, color: 0xFF00FF00, w: 450, h: 300, x: 600, y: 600}
        ]}])

        let t1 = stage.root.tag('t1');

        setInterval(function() {
            t1.add({rect: true, x: Math.random() * 100, y: Math.random() * 100, w: Math.random() * 100, h : Math.random() * 100, color: Math.random() * 0xFFFFFFFF});
        }, 50)

        setInterval(function() {
            t1.removeChildAt(Math.floor(t1.children.length * Math.random()));
        }, 133);
    }
};

if (typeof window === "undefined") {
    // Nodejs: start.
    start(require('../../wpe'));
}
