// fgnass.github.com/spin.js#v1.2.5
// Modified for Auphonic
(function() {

/**
* Copyright (c) 2011 Felix Gnass [fgnass at neteye dot de]
* Licensed under the MIT license
*/

var prefixes = ['webkit', 'Moz', 'ms', 'O']; /* Vendor prefixes */
var animations = {}; /* Animation rules keyed by their name */
var useCssAnimations;

/**
 * Utility function to create elements. If no tag name is given,
 * a DIV is created. Optionally properties can be passed.
 */
function createEl(tag, prop) {
  var el = document.createElement(tag || 'div');
  var n;

  for(n in prop) {
    el[n] = prop[n];
  }
  return el;
}

/**
 * Appends children and returns the parent.
 */
function ins(parent /* child1, child2, ...*/) {
  for (var i=1, n=arguments.length; i<n; i++) {
    parent.appendChild(arguments[i]);
  }
  return parent;
}

/**
 * Insert a new stylesheet to hold the @keyframe or VML rules.
 */
var sheet = function() {
  var el = createEl('style');
  ins(document.getElementsByTagName('head')[0], el);
  return el.sheet || el.styleSheet;
}();

/**
 * Creates an opacity keyframe animation rule and returns its name.
 * Since most mobile Webkits have timing issues with animation-delay,
 * we create separate rules for each line/segment.
 */
function addAnimation(alpha, trail, i, lines) {
  var name = ['opacity', trail, ~~(alpha*100), i, lines].join('-');
  var start = 0.01 + i/lines*100;
  var z = Math.max(1-(1-alpha)/trail*(100-start) , alpha);
  var prefix = useCssAnimations.substring(0, useCssAnimations.indexOf('Animation')).toLowerCase();
  var pre = prefix && '-'+prefix+'-' || '';

  if (!animations[name]) {
    sheet.insertRule(
      '@' + pre + 'keyframes ' + name + '{' +
      '0%{opacity:'+z+'}' +
      start + '%{opacity:'+ alpha + '}' +
      (start+0.01) + '%{opacity:1}' +
      (start+trail)%100 + '%{opacity:'+ alpha + '}' +
      '100%{opacity:'+ z + '}' +
      '}', 0);
    animations[name] = 1;
  }
  return name;
}

/**
 * Tries various vendor prefixes and returns the first supported property.
 **/
function vendor(el, prop) {
  var s = el.style;
  var pp;
  var i;

  if(s[prop] !== undefined) return prop;
  prop = prop.charAt(0).toUpperCase() + prop.slice(1);
  for(i=0; i<prefixes.length; i++) {
    pp = prefixes[i]+prop;
    if(s[pp] !== undefined) return pp;
  }
}

/**
 * Sets multiple style properties at once.
 */
function css(el, prop) {
  for (var n in prop) {
    el.style[vendor(el, n)||n] = prop[n];
  }
  return el;
}

/**
 * Fills in default values.
 */
function merge(obj) {
  for (var i=1; i < arguments.length; i++) {
    var def = arguments[i];
    for (var n in def) {
      if (obj[n] === undefined) obj[n] = def[n];
    }
  }
  return obj;
}

var defaults = {
  lines: 12,            // The number of lines to draw
  length: 7,            // The length of each line
  width: 5,             // The line thickness
  radius: 10,           // The radius of the inner circle
  rotate: 0,            // rotation offset
  color: '#000',        // #rgb or #rrggbb
  speed: 1,             // Rounds per second
  trail: 100,           // Afterglow percentage
  opacity: 1/4,         // Opacity of the lines
  fps: 20,              // Frames per second when using setTimeout()
  zIndex: 2e9,          // Use a high z-index by default
  className: 'spinner', // CSS class to assign to the element
};

/** The constructor */
var Spinner = function Spinner(o) {
  if (!this.spin) return new Spinner(o);
  this.opts = merge(o || {}, Spinner.defaults, defaults);
};

Spinner.defaults = {};
merge(Spinner.prototype, {
  isSpinning: function() {
    return this.spinning;
  },

  spin: function(target) {
    if (this.isSpinning()) return this;

    this.stop();
    var self = this;
    var o = self.opts;
    var el = self.el = css(createEl(0, {className: o.className}), {zIndex: o.zIndex});

    if (target) target.insertBefore(el, target.firstChild||null);

    el.setAttribute('aria-role', 'progressbar');
    self.lines(el, self.opts);

    if (!useCssAnimations) {
      // No CSS animation support, use setTimeout() instead
      var i = 0;
      var fps = o.fps;
      var f = fps/o.speed;
      var ostep = (1-o.opacity)/(f*o.trail / 100);
      var astep = f/o.lines;

      !function anim() {
        i++;
        for (var s=o.lines; s; s--) {
          var alpha = Math.max(1-(i+s*astep)%f * ostep, o.opacity);
          self.opacity(el, o.lines-s, alpha, o);
        }
        self.timeout = self.el && setTimeout(anim, ~~(1000/fps));
      }();
    }

    this.spinning = true;

    return self;
  },
  stop: function() {
    var el = this.el;
    if (el) {
      clearTimeout(this.timeout);
      if (el.parentNode) el.parentNode.removeChild(el);
      this.el = undefined;
      this.spinning = false;
    }
    return this;
  },
  lines: function(el, o) {
    var i = 0;
    var seg;

    function fill(color, shadow) {
      return css(createEl(), {
        position: 'absolute',
        width: (o.length+o.width) + 'px',
        height: o.width + 'px',
        background: color,
        boxShadow: shadow,
        transformOrigin: 'left',
        transform: 'rotate(' + ~~(360/o.lines*i+o.rotate) + 'deg) translate(' + o.radius+'px' +',0)',
        borderRadius: (o.width>>1) + 'px'
      });
    }
    for (; i < o.lines; i++) {
      seg = css(createEl(), {
        position: 'absolute',
        top: 1+~(o.width/2) + 'px',
        transform: o.hwaccel ? 'translate3d(0,0,0)' : '',
        opacity: o.opacity,
        animation: useCssAnimations && addAnimation(o.opacity, o.trail, i, o.lines) + ' ' + 1/o.speed + 's linear infinite'
      });
      if (o.shadow) ins(seg, css(fill('#000', '0 0 4px ' + '#000'), {top: 2+'px'}));
      ins(el, ins(seg, fill(o.color, '0 0 1px rgba(0,0,0,.1)')));
    }
    return el;
  },
  opacity: function(el, i, val) {
    if (i < el.childNodes.length) el.childNodes[i].style.opacity = val;
  }
});

useCssAnimations = vendor(document.createElement('div'), 'animation');

window.Spinner = Spinner;

})();
