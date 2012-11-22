var Core = require('Core');
var Class = Core.Class;
var Element = Core.Element;
var Browser = Core.Browser;

var Handlebars = require('Handlebars');
require('Templates');

// Load PowerTools! Extensions
require('Class-Extras');
require('Custom-Event');
require('Mobile');

// Load Extensions
require('Extensions/Array');
require('Extensions/Element');
require('Extensions/HandlebarsHelper');
require('Extensions/Transition');
require('Extensions/Slick');
require('Extensions/Object');

// Dev Environment setup
require('Dev');

// Set up Formatters
require('App/Data');
require('App/OutgoingService');
var Data = require('App/Data');
var User = require('Store/User');

// Load Controllers
var Controller = require('Controller');
require('Controller/Login');
require('Controller/Preset');
require('Controller/Production');
require('Controller/Recording');

var History = require('History');
var Form = require('Form');
var ActiveState = require('Browser/ActiveState');
var PreventClickOnScroll = require('Browser/PreventClickOnScroll');

var API = require('API');
var UI = require('UI');
var View = require('View');
var Controller = require('Controller');
var SwipeAble = require('UI/Actions/SwipeAble');
var Popover = require('UI/Actions/Popover');
var Notice = require('UI/Notice');
var Spinner = require('Spinner');

var AudioPlayer = require('Player/AudioPlayer');
var WebAudioService = require('Player/WebAudioService');
var CordovaAudioService = require('Player/CordovaAudioService');

var Auphonic = require('Auphonic');
var Platform = require('Platform');

// Register Partials for Handlebars
Handlebars.registerPartial('preset', Handlebars.templates.preset);
Handlebars.registerPartial('production', Handlebars.templates.production);
Handlebars.registerPartial('player', Handlebars.templates.player);
Handlebars.registerPartial('algorithm-popover', Handlebars.templates['algorithm-popover']);

// Monkey Patch for Cordova which sometimes adds file:///
var getPath = History.getPath;
History.getPath = function() {
  return '/' + getPath.call(this).replace(/^\/|^file\:\/\/\//, '');
};

var preventDefault = function(event) {
  event.preventDefault();
};

var cancelText = 'Navigating away will discard all your changes. Press "Cancel" to stay.';
// This should catch all important editing URLs
var formURLs = /^\/?(production|preset)\/(edit|new)/i;
var popoverSelector = 'div.popover';
var click = function(event) {
  event.preventDefault();
  var href = this.get('href');
  var activeElement = document.activeElement;

  if (!href) return;
  if (event.touches && event.touches.length > 1) return;
  if (activeElement && activeElement.match('input, select, textarea')) activeElement.blur();

  var currentPath = History.getPath();
  var isFooter = !!this.getParent('footer');

  if (isFooter && formURLs.test(currentPath)) {
    // This is unbelieveably hacky but mobile safari alerts show parts of the URL
    // which isn't very pretty. This way the title of the alert says "Please Confirm".
    History.detach();
    window.history.pushState(null, null, '/Hey, wait a second.');
    var confirmed = window.confirm(cancelText);
    window.history.pushState(null, null, currentPath);
    History.attach();
    if (!confirmed) return;
  }

  if (UI.isHighlighted(this)) {
    if (!isFooter) return;

    // Tap on footer icon
    if (currentPath == href) {
      // Invalidate and rename stack to force re-evaluation
      View.getMain().getCurrentObject().invalidate();
      View.getMain().getStack().setName('invalid');
    }
  }

  if (!this.getParent(popoverSelector))
    UI.highlight(this);

  History.push(href);
};

var clickExternal = function(event) {
  event.preventDefault();
  var href = this.get('href');
  window.location.href = href + (~href.indexOf('#') ? '' : '#') + '!external';
};

var onLabelClick = function(event) {
  event.preventDefault();

  var input = this.getElement('input, select, textarea');
  if (input) input.focus();
};

var onDeleteClick = function(event) {
  if (event) event.preventDefault();

  removeItem(Popover.getBaseElement(this.getParent(popoverSelector)));
};

var removeItem = function(element) {
  element.addClass('fade');
  (function() {
    element.addEvent('transitionComplete:once', function() {
      var event = this.get('data-fire-event');
      var id = this.get('data-id');
      if (event) this.fireEvent(event, [id]);

      this.destroy();
    }).addClass('out');
  }).delay(10);

  var url = element.get('data-api-url');
  var method = element.get('data-method');
  if (url && method) API.call(url, method);
};

// Make the info API call and show the UI on success, or else provide a reload button
var spinner;
var isLoggedIn = User.isLoggedIn();
var load = function(event) {
  if (event) event.preventDefault();

  isLoggedIn = User.isLoggedIn();

  var retry = document.id('retry');
  retry.hide();

  if (!spinner) {
    var nativeSpinner = window.__NATIVE_SPINNER;
    if (nativeSpinner && nativeSpinner.isSpinning()) spinner = nativeSpinner;
    else spinner = new Spinner(Auphonic.SpinnerOptions);
  }

  if (isLoggedIn) spinner.spin(document.id('splash'));
  else spinner.stop();

  API.cacheInfo({
    silent: !isLoggedIn,
    formatter: Data.formatInfos
  }).on({
    success: function() {
      Notice.closeAll();
      if (!isLoggedIn) return;

      spinner.stop();
      UI.showChrome();
      History.push('/');
    },
    error: function() {
      spinner.stop();
      var retry = document.id('retry').show();
      retry.getElement('a').addEvent('click', load);
    }
  });
};

// This is a lot of glue code !
window.__BOOTAPP = function() {
  document.body.addClass(window.__PLATFORM);

  load();

  var activeState = (new ActiveState({
    active: 'active',
    hit: 'hit',
    hitProperty: 'data-hit-target'
  }));
  activeState.attach();

  if (Browser.Platform.ios) {
    (new PreventClickOnScroll({
      selector: 'div.scrollable',
      contentSelector: 'div.scroll-content',
      activeState: activeState
    })).attach();

    // Prevent all clicks from working normally
    window.addEventListener('click', preventDefault, false);

    var iPhone5 = (window.screen.height == 568);
    if (!iPhone5) UI.setTransitionDelay(50);
  }

  Element.defineDefaultTransitionDelay(UI.getTransitionDelay());

  document.body.adopt(Element.from(UI.render('ui')));

  UI.register({

    '#main a:external, a.register, div.notice-inner a': function(elements) {
      elements.addEvent('click', clickExternal);
    },

    '#main a:internal': function(elements) {
      elements.addEvent('click', click);
    },

    'footer a:internal': function(elements) {
      elements.addEvents({
        touchstart: click,
        click: preventDefault
      });
    },

    'a.deleteable': function(elements) {
      elements.addEvent('click', onDeleteClick);
    },

    'label.info, .show-popover': Class.Instantiate(Popover, {
      selector: popoverSelector,
      scrollSelector: 'div.scrollable',
      positionProperty: 'data-position',
      eventProperty: 'data-popover-open-event',
      closeEventProperty: 'data-popover-close-event',
      openDelay: 'data-popover-open-delay',
      animationClass: 'fade',
      arrowHeight: 14
    }),

    'input[data-clearable]': Class.Instantiate(Form.Clearable, {
      className: 'clearable-visible'
    }),
    'div.checkbox': Class.Instantiate(Form.Checkbox),
    'textarea.autogrow': Class.Instantiate(Form.AutoGrow),

    'select.empty': Class.Instantiate(Form.EmptySelect, {
      placeholderPosition: '!',
      placeholder: '.placeholder',
    }),

    '.swipeable': Class.Instantiate(SwipeAble, {

      selector: '.removable > span',
      scrollableSelector: 'div.scrollable',
      removedClass: 'item-removed',

      onClick: function() {
        removeItem(this.container);
      },

      onSwipe: function() {
        this.container.getElement('> a').addClass('swiped');
      },

      onComplete: function() {
        this.container.getElement('> a').removeClass('swiped');
      }

    }),

    'label': function(elements) {
      // Show the keyboard immediately without a 300ms delay (iOS 6 feature)
      elements.addEvent('click', onLabelClick);
      // However, without this, the keyboard will go away again immediately
      elements.each(function(element) {
        element.onclick = onLabelClick;
      });
    },

    '.player': Class.Instantiate(AudioPlayer, {
      selector: '[data-media]',
      durationSelector: '[data-duration]',
      localSelector: '[data-local]',
      chapterSelector: '[data-chapters]',
      currentTimeSelector: 'div.player-details div.current-time',
      chapterMarkSelector: 'div.player-details div.chapter-mark',
      playSelector: 'a.play',
      waveformSelector: 'div.waveform',
      positionSelector: 'div.waveform div.position',
      spinnerOptions: Auphonic.PlayerSpinnerOptions,

      getAudioService: function() {
        // Use CordovaAudioService for local files because it is faster/better/prettier
        return (this.isLocal && window.Media) ? CordovaAudioService : WebAudioService;
      },

      onSetup: function() {
        View.getMain().getCurrentObject().addEvent('hide', this.bound('reset'));
      },

      onSeek: function(position, pixel) {
        var waveform = this.getWaveform();
        var popover = waveform.getInstanceOf(Popover);
        var popoverElement = popover.getPopover();
        popoverElement.set('text', Data.formatDuration(position / 1000, ' ', true));

        var reposition = function() {
          // Checking if we overflow the screen on the right
          var waveformLeft = waveform.offsetLeft;
          var bodyWidth = document.body.offsetWidth;
          var width = popoverElement.offsetWidth;
          var left = pixel + waveformLeft - width / 2;
          var overflow = (left + width + 10) - bodyWidth;
          if (overflow > 0) left -= overflow;
          popoverElement.setStyle('left', left);
        };

        reposition();
        if (!popover.isOpen() && popover.getOpenDelay())
          reposition.delay(popover.getOpenDelay());
      }
    }),

    '[data-belongs-to]': function(elements) {
      elements.each(function(element) {
        if (element.retrieve(':belongs-to-attached')) return;
        element.store(':belongs-to-attached', true);
        var owner = document.getElement('input[name=' + element.get('data-belongs-to') + ']');
        if (!owner) return;

        // HACKY: Prevent ghost clicks on the underlying <select> element on iOS
        owner.getParent('div.checkbox').addEventListener('click', function(event) {
          event.stopPropagation();
        }, false);

        owner.addEvent('change', function() {
          if (this.get('checked')) element.removeClass('fade');
          else element.addClass('fade');
        });
      });
    }

  }).update();

  Notice.setContainer(document.body);
  Notice.setTemplate(new Element('div.notice').adopt(new Element('div.close'), new Element('div.notice-inner.text')));

  var notice;
  var noticeText;
  var errorHandler = function(event, data) {
    View.getMain().hideIndicator();
    UI.unhighlight(UI.getHighlightedElement());

    if (event.isPrevented()) return;

    var text = '';
    if (data && data.status_code) text = '<h1>An error occurred</h1> Please try again or <a href="{IssuesURL}">report a bug</a> so we can fix this as soon as possible.'.substitute(Auphonic);
    else text = '<h1>A network error ocurred</h1> Please put your device in some elevated position to regain Internet access. If the problem lies on our end we\'ll make sure to fix the problem quickly :)';

    // If the last notice with the same text is still visible we'll not show another one.
    if (notice && notice.isOpen() && noticeText == text) {
      notice.push();
      return;
    }

    noticeText = text;
    notice = new Notice(text, {type: 'error'});
  };

  API.setTimeoutHandler(errorHandler);
  API.setErrorHandler(errorHandler);

  UI.addEvents({
    enable: Popover.enable,
    disable: Popover.disable
  });

  var header = document.getElement('header');
  var back = new UI.BackButton(header, new Element('a'));
  var action = new UI.ActionButton(header, new Element('a'), {
    onClick: click
  });
  var title = new UI.Title(header, new Element('h1'));

  View.setMain(new View.Controller('main', {
    template: 'container',
    contentSelector: 'div.scroll-content',
    scrollableSelector: 'div.scrollable',

    back: back,
    title: title,
    action: action,
    indicatorOptions: Auphonic.ViewSpinnerOptions,
    smallIndicatorOptions: Auphonic.ViewSpinnerOptionsSmall,
    indicatorDelay: 500,

    iOSScrollFlashFix: Auphonic.EnableIOSScrollFlashFix,

    onChange: function() {
      var stackName = this.getStack().getName();
      UI.highlight(document.getElement('footer .' + stackName));
      this.getTitle().toElement().addClass(stackName);
    },

    onTransitionEnd: function() {
      if (Platform.isAndroid())
        this.getBack().toElement().getSiblings('.button-left').dispose();

      var stack = this.getStack();
      var previous = stack && stack.getPrevious();
      if (previous && previous.isRendered()) previous.toElement().getElements('ul li a.selected').removeClass('selected');
    }
  }));

  Controller.define('/', {isGreedy: true}, function() {
     // Call this so in case of a login with a failed attempt to load the infos we attempt to load them again.
     // It'll also take care of showing the UI.
    load();

    View.getMain().push('home', new View.Object({
      title: Platform.isIOS() ? '' : 'Home',
      backTitle: 'Home',
      content: UI.render('home', {
        feedback: Auphonic.FeedbackURL
      })
    }));
  });

  Controller.define('/about', function() {
    View.getMain().push(new View.Object({
      title: 'About',
      content: UI.render('about', {
        user: User.get(),
        version: Auphonic.Version,
        repository: Auphonic.RepositoryURL
      })
    }));
  });

  Controller.define('/team', function() {
    View.getMain().push(new View.Object({
      title: 'Team',
      content: UI.render('team', {
        image: Auphonic.TeamImage,
        twitter: Auphonic.TwitterURL,
        facebook: Auphonic.FacebookURL
      })
    }));
  });

  Controller.define('/external-services', function() {
    View.getMain().showIndicator();

    API.call('services').on({
      success: function(response) {
        View.getMain().push(new View.Object({
          title: 'External Services',
          content: UI.render('external-services', {
            url: Auphonic.ExternalServicesURL,
            services: response.data
          })
        }));
      }
    });
  });

  Controller.define('/logout', function() {
    User.reset();
    View.getMain().resetStack();

    History.push('/login');
  });

  if (!isLoggedIn) History.push('/login');

  delete window.__BOOTAPP; // bye!
};

API.setAPIURL(Auphonic.APIURL);
API.setLogHandler(function(data) {
  if (window.__DEV__) return null;

  var device = window.device;
  data.platform = ((device && device.platform) || (Browser.name + '; ' + (Browser.Device.name != 'other' ? Browser.Device.name : Browser.Platform.name))).toLowerCase();
  data.os_version = (device && device.version) || Browser.version;
  data.device = ((device && device.name) || '').toLowerCase();
  data.version = Auphonic.Version;
  if (data.platform == 'iphone' || data.platform == 'ipod touch') data.hardware = (window.screen.height == 568) ? 5 : 4;
  return data;
});

window.onerror = function(msg, url, line) {
  // Just in case…
  UI.enable();
  View.getMain().hideIndicator();

  var stack;
  try {
    throw new Error;
  } catch(e) {
    stack = e.stack;
  }

  API.log({
    type: 'js-error',
    message: msg,
    url: url,
    line: line,
    stack: stack // Praying that this is set.
  });

  return false;
};

// TODO(cpojer): remove this after the next deploy to the App Store.
var css = new Element('style');
css.type = 'text/css';
css.innerHTML = 'div.detail div.dark-background { background-image: url(./Splash.jpg); }';
css.inject(document.head);

// REMOVE after pushing an update to Cordova 2.2.0/1.0.1 on iOS
if (!window.__PLATFORM) window.__PLATFORM = 'ios';
