'use strict';

/**
 * Enum for different event names used for tab-communication
 * @type {Object}
 */
const PostMessageEventNamesEnum = {
  LOADED: '__TAB__LOADED_EVENT__',
  CUSTOM: '__TAB__CUSTOM_EVENT__',
  HANDSHAKE: '__TAB__HANDSHAKE_EVENT__',
  ON_BEFORE_UNLOAD: '__TAB__ON_BEFORE_UNLOAD__',
  PARENT_DISCONNECTED: '__PARENT_DISCONNECTED__',
  HANDSHAKE_WITH_PARENT: '__HANDSHAKE_WITH_PARENT__',
  PARENT_COMMUNICATED: '__PARENT_COMMUNICATED__'
};

let arrayUtils = {};

/**
 * Different type of data needed after searching an item(Object) within data(Array of Objects).
 * 1. `INDEX` returns just the index at which the item was present
 * 2. `OBJECT` returns the matched object
 * 3. `BOTH` returns an object { obj: matched_object, index: index_found }
 */
let returnPreferenceEnum = {
  INDEX: 'index',
  OBJECT: 'object',
  BOTH: 'both'
};

/**
 * Search for an item(Object) within a data-set(Array Of Objects)
 * @param  {Array of Objects} data
 * @param  {String} key - Unique key to search on the basis of
 * @param  {String} value - The matching criteria
 * @param  {String} returnPreference - what kind of output is needed
 * @return {Object}
 */
arrayUtils.searchByKeyName = (data, key, value, returnPreference) => {
  if (!data || !key) {
    return false;
  }

  returnPreference = returnPreference || returnPreferenceEnum[1]; // default to Object
  let i,
    obj,
    returnData,
    index = -1;

  for (i = 0; i < data.length; i++) {
    obj = data[i];
    // Number matching support
    if (!isNaN(value) && parseInt(obj[key], 10) === parseInt(value, 10)) {
      index = i;
      break;
    } else if (isNaN(value) && obj[key] === value) {
      // String exact matching support
      index = i;
      break;
    }
  }

  if (index === -1) {
    // item not found
    data[index] = {}; // for consistency
  }

  switch (returnPreference) {
    case returnPreferenceEnum.INDEX:
      returnData = index;
      break;
    case returnPreferenceEnum.BOTH:
      returnData = {
        obj: data[index],
        index: index
      };
      break;
    case returnPreferenceEnum.OBJECT:
    default:
      returnData = data[index];
      break;
  }

  return returnData;
};

/**
 * Enum for Tab status(still opened / closed) used for tab-communication
 * @type {Object}
 */
const TabStatusEnum = {
  OPEN: 'open',
  CLOSE: 'close'
};

/**
 * Enum for showing various warnings to suser when things done wrong
 * @type {Object}
 */
const WarningTextEnum = {
  INVALID_JSON: 'Invalid JSON Object!',
  INVALID_DATA: 'Some wrong message is being sent by Parent.',
  CONFIG_REQUIRED: 'Configuration options required. Please read docs.',
  CUSTOM_EVENT: "CustomEvent(and it's polyfill) is not supported in this browser.",
  URL_REQUIRED: 'Url is needed for creating and opening a new window/tab. Please read docs.'
};

/**
 * A Tab utility file to deal with tab operations
 */

let tabUtils = {
  tabs: [],
  config: {}
};

/**
 * Remove a tab from a list of all tabs.
 * This is required when users opts for removing the closed tabs from the list of tabs.
 * This can be done explictly by passing `removeClosedTabs` key while instantiating Parent.
 * @param  {Object} tab
 */
tabUtils._remove = tab => {
  let index;

  index = arrayUtils.searchByKeyName(tabUtils.tabs, 'id', tab.id, 'index');
  tabUtils.tabs.splice(index, 1);
};

/**
 * As explained in `event-listeners/postmessage.js` file,
 * the data received from postmessage API is further processed based on our convention
 * @param  {String} msg
 * @return {String} modified msg
 */
tabUtils._preProcessMessage = msg => {
  // make msg always an object to support JSON support
  try {
    msg = tabUtils.config.stringify(msg);
  } catch (e) {
    throw new Error(WarningTextEnum.INVALID_JSON);
  }

  if (msg && msg.indexOf(PostMessageEventNamesEnum.PARENT_COMMUNICATED) === -1) {
    msg = PostMessageEventNamesEnum.PARENT_COMMUNICATED + msg;
  }

  return msg;
};
/**
 * Add a new tab to the Array of tabs
 * @param  {Object} tab
 * @return {Object} - this
 */
tabUtils.addNew = tab => {
  tabUtils.tabs.push(tab);
  return undefined;
};
/**
 * Filter out all the opened tabs
 * @return {Array} - only the opened tabs
 */
tabUtils.getOpened = () => {
  return tabUtils.tabs.filter(tab => tab.status === TabStatusEnum.OPEN);
};
/**
 * Filter out all the closed tabs
 * @return {Array} - only the closed tabs
 */
tabUtils.getClosed = () => {
  return tabUtils.tabs.filter(tab => tab.status === TabStatusEnum.CLOSE);
};
/**
 * To get list of all tabs(closed/opened).
 * Note: Closed tabs will not be returned if `removeClosedTabs` key is paased while instantiaiting Parent.
 * @return {Array} - list of all tabs
 */
tabUtils.getAll = () => {
  return tabUtils.tabs;
};

/**
 * Close a specific tab
 * @param  {String} id
 * @return {Object} this
 */
tabUtils.closeTab = id => {
  let tab = arrayUtils.searchByKeyName(tabUtils.tabs, 'id', id);

  if (tab && tab.ref) {
    tab.ref.close();
    tab.status = TabStatusEnum.CLOSE;
  }

  return tabUtils;
  // --tabUtils.tabs.length;
};
/**
 * Close all opened tabs using a native method `close` available on window.open reference.
 * @return {tabUtils} this
 */
tabUtils.closeAll = () => {
  let i;

  for (i = 0; i < tabUtils.tabs.length; i++) {
    if (tabUtils.tabs[i] && tabUtils.tabs[i].ref) {
      tabUtils.tabs[i].ref.close();
      tabUtils.tabs[i].status = TabStatusEnum.CLOSE;
    }
  }

  return tabUtils;
};
/**
 * Send a postmessage to every opened Child tab(excluding itself i.e Parent Tab)
 * @param  {String} msg
 * @param  {Boolean} isSiteInsideFrame
 */
tabUtils.broadCastAll = (msg, isSiteInsideFrame) => {
  let i,
    tabs = tabUtils.getOpened();

  msg = tabUtils._preProcessMessage(msg);

  for (i = 0; i < tabs.length; i++) {
    tabUtils.sendMessage(tabs[i], msg, isSiteInsideFrame);
  }

  return tabUtils;
};
/**
 * Send a postmessage to a specific Child tab
 * @param  {String} id
 * @param  {String} msg
 * @param  {Boolean} isSiteInsideFrame
 */
tabUtils.broadCastTo = (id, msg, isSiteInsideFrame) => {
  let targetedTab,
    tabs = tabUtils.getAll();

  msg = tabUtils._preProcessMessage(msg);

  targetedTab = arrayUtils.searchByKeyName(tabs, 'id', id); // TODO: tab.id
  tabUtils.sendMessage(targetedTab, msg, isSiteInsideFrame);

  return tabUtils;
};

/**
 * Send a postMessage to the desired window/frame
 * @param  {Object}  target
 * @param  {String}  msg
 * @param  {Boolean} isSiteInsideFrame
 */
tabUtils.sendMessage = (target, msg, isSiteInsideFrame) => {
  let origin = tabUtils.config.origin || '*';
  if (isSiteInsideFrame && target.ref[0]) {
    for (let i = 0; i < target.ref.length; i++) {
      target.ref[i].postMessage(msg, origin);
    }
  } else if (target.ref && target.ref.top) {
    target.ref.top.postMessage(msg, origin);
  }
};

/**
 * UUID.js: The RFC-compliant UUID generator for JavaScript.
 * ES6 port of only `generate` method of UUID by Varun Malhotra under MIT License
 *
 * @author  LiosK
 * @version v3.3.0
 * @license The MIT License: Copyright (c) 2010-2016 LiosK.
 */

/** @constructor */
let UUID;

UUID = (function() {

  /** @lends UUID */
  function UUID() {}

  /**
   * The simplest function to get an UUID string.
   * @returns {string} A version 4 UUID string.
   */
  UUID.generate = function() {
    let rand = UUID._getRandomInt,
      hex = UUID._hexAligner;

    // ["timeLow", "timeMid", "timeHiAndVersion", "clockSeqHiAndReserved", "clockSeqLow", "node"]
    return (
      hex(rand(32), 8) + // time_low
      '-' +
      hex(rand(16), 4) + // time_mid
      '-' +
      hex(0x4000 | rand(12), 4) + // time_hi_and_version
      '-' +
      hex(0x8000 | rand(14), 4) + // clock_seq_hi_and_reserved clock_seq_low
      '-' +
      hex(rand(48), 12)
    ); // node
  };

  /**
   * Returns an unsigned x-bit random integer.
   * @param {int} x A positive integer ranging from 0 to 53, inclusive.
   * @returns {int} An unsigned x-bit random integer (0 <= f(x) < 2^x).
   */
  UUID._getRandomInt = function(x) {
    if (x < 0) {
      return NaN;
    }
    if (x <= 30) {
      return 0 | (Math.random() * (1 << x));
    }
    if (x <= 53) {
      return (0 | (Math.random() * (1 << 30))) + (0 | (Math.random() * (1 << (x - 30)))) * (1 << 30);
    }

    return NaN;
  };

  /**
   * Returns a function that converts an integer to a zero-filled string.
   * @param {int} radix
   * @returns {function(num&#44; length)}
   */
  UUID._getIntAligner = function(radix) {
    return function(num, length) {
      let str = num.toString(radix),
        i = length - str.length,
        z = '0';

      for (; i > 0; i >>>= 1, z += z) {
        if (i & 1) {
          str = z + str;
        }
      }
      return str;
    };
  };

  UUID._hexAligner = UUID._getIntAligner(16);

  /**
   * Returns UUID string representation.
   * @returns {string} {@link UUID#hexString}.
   */
  UUID.prototype.toString = function() {
    return this.hexString;
  };

  return UUID;
})();

var UUID$1 = UUID;

/**
 * This utility helps enabling/disabling the Link/Button on the Parent Tab.
 * As soon as, user clicks on link/btn to open a new tab, the link/btn gets disabled.
 * Once child communicates for the first time with the Parent, the link/btn is re-enabled to open up new tab.
 * This feature is toggleable and can be used explicitly putting a data attribute on the link/btn.
 *
 * <a href="/demo.html" data-tab-opener="parent" target="_blank" on-click="parent.openNewTab(config)">Open Tab</a>
 */
let domUtils = {
  disable: selector => {
    if (!selector) {
      return false;
    }

    let i,
      ATOpenerElems = document.querySelectorAll('[' + selector + ']');

    for (i = 0; i < ATOpenerElems.length; i++) {
      ATOpenerElems[i].setAttribute('disabled', 'disabled');
    }
  },
  enable: selector => {
    if (!selector) {
      return false;
    }

    let i,
      ATOpenerElems = document.querySelectorAll('[' + selector + ']');

    for (i = 0; i < ATOpenerElems.length; i++) {
      ATOpenerElems[i].removeAttribute('disabled');
    }
  }
};

// Named Class expression
class Tab {
  /**
   * Invoked when the object is instantiated
   */
  constructor() {
    // Set name of Parent tab if not already defined
    window.name = window.name || 'PARENT_TAB';
  }
  /**
   * Open a new tab
   * @param  {Object} config - Refer API for config keys
   * @return {Object} this
   */
  create(config) {
    config = config || {};
    Object.assign(this, config);
    this.id = UUID$1.generate() || tabUtils.tabs.length + 1;
    this.status = 'open';
    // Refere https://developer.mozilla.org/en-US/docs/Web/API/Window/open#Window_features for WindowFeatures
    this.ref = window.open(this.url, config.windowName || '_blank', config.windowFeatures);

    domUtils.disable('data-tab-opener');

    window.newlyTabOpened = {
      id: this.id,
      name: this.name || this.windowName,
      ref: this.ref
    };

    // Push it to the list of tabs
    tabUtils.addNew(this);

    // Return reference for chaining purpose
    return this;
  }
}

// import '../utils/customEventPolyfill';

let PostMessageListener = {};

/*
 * Custom PostMessage Convetions Followed - Sending and Receieving data gracefully
 * -------------------------------------------------------------------------------
 *
 * 1. First convetion
      Since data can be sent or receieved via postmessge API in the form of strings,
      the library stores data as stringified JSON object and while reading it, parses the JSON stringified earlier.
      This is easy to maintain and deal with data.

 * 2. Second Convetions
      With every data, there's an associated message identifier.
      A message identifier helps in knowing the intention of what event actually is for.
      For eg: To send data after proper establishment from Child tab,
      Parent tab acknowledges the connection by returning the true identity of the Child tab.
      This is done via prepending the Event name i.e. HANDSHAKE_WTIH_PARENT

      So the postmessage's message would like: `HANDSHAKE_WTIH_PARENT{"id": 123, "name": "Hello World!"}`.
      So, while reading the message, it has to be first checked up with the defined event names
      and then after successful match, the message is split using the Event-name as a delimiter.
      The first entry if the event name and the second one is the actual data.
 *
 */

/**
 * OnLoad Event - it serves as an communication establishment source from Child tab
 */
PostMessageListener._onLoad = data => {
  let tabs,
    dataToSend,
    tabInfo = data.split(PostMessageEventNamesEnum.LOADED)[1];

  // Child was opened but parent got refereshed, opened a tab i.e.
  // last opened tab will get refreshed(browser behavior). WOW! Handle this now.
  if (tabInfo) {
    try {
      tabInfo = tabUtils.config.parse(tabInfo);
      // If Child knows its UUID, means Parent was refreshed and Child did not
      if (tabInfo.id) {
        tabs = tabUtils.getAll();
        if (tabs.length) {
          window.newlyTabOpened = tabs[tabs.length - 1];
          window.newlyTabOpened.id = tabInfo.id;
          window.newlyTabOpened.name = tabInfo.name || tabInfo.windowName;
        }
      }
    } catch (e) {
      throw new Error(WarningTextEnum.INVALID_JSON);
    }
  }

  if (window.newlyTabOpened) {
    try {
      dataToSend = PostMessageEventNamesEnum.HANDSHAKE_WITH_PARENT;
      dataToSend += tabUtils.config.stringify({
        id: window.newlyTabOpened.id,
        name: window.newlyTabOpened.name || window.newlyTabOpened.windowName,
        parentName: window.name
      });
      tabUtils.sendMessage(window.newlyTabOpened, dataToSend, tabInfo.isSiteInsideFrame);
    } catch (e) {
      throw new Error(WarningTextEnum.INVALID_JSON);
    }
  }
};

/**
 * onCustomMessage Event - Any sort of custom message by child is treated here
 * @param  {Object} data
 *
 * The method fires an event to notify Parent regarding Child's behavior
 */
PostMessageListener._onCustomMessage = (data, type) => {
  let event,
    eventData,
    tabInfo = data.split(type)[1];

  try {
    tabInfo = tabUtils.config.parse(tabInfo);
  } catch (e) {
    throw new Error(WarningTextEnum.INVALID_JSON);
  }

  eventData = {
    tabInfo,
    type
  };

  event = new CustomEvent('onCustomChildMessage', { detail: eventData });

  window.dispatchEvent(event);
  // window.newlyTabOpened = null;
};

/**
 * onBeforeUnload Event - Tells parent that either Child tab was closed or refreshed.
 * Child uses native `ON_BEFORE_UNLOAD` method to notify Parent.
 *
 * It sets the newlyTabOpened variable accordingly
 *
 * @param  {Object} data
 */
PostMessageListener._onBeforeUnload = data => {
  let tabs,
    tabInfo = data.split(PostMessageEventNamesEnum.ON_BEFORE_UNLOAD)[1];

  try {
    tabInfo = tabUtils.config.parse(tabInfo);
  } catch (e) {
    throw new Error(WarningTextEnum.INVALID_JSON);
  }

  if (tabUtils.tabs.length) {
    tabs = tabUtils.getAll();
    window.newlyTabOpened = arrayUtils.searchByKeyName(tabs, 'id', tabInfo.id) || window.newlyTabOpened;
  }

  // CustomEvent is not supported in IE, but polyfill will take care of it
  let event = new CustomEvent('onChildUnload', { detail: tabInfo });

  window.dispatchEvent(event);
};

/**
 * onNewTab - It's the entry point for data processing after receiving any postmessage form any Child Tab
 * @param  {Object} message
 */
PostMessageListener.onNewTab = message => {
  let data = message.data;

  /**
   * Safe check - This happens when CHild Tab gets closed just after sending a message.
   * No need to go further from this point.
   * Tab status is automatically fetched using our polling mechanism written in `Parent.js` file.
   */
  if (!data || typeof data !== 'string' || !tabUtils.tabs.length) {
    return false;
  }

  // `origin` check for secureity point of view
  if (tabUtils.config.origin && tabUtils.config.origin !== message.origin) {
    return false;
  }

  if (data.indexOf(PostMessageEventNamesEnum.LOADED) > -1) {
    PostMessageListener._onLoad(data);
  } else if (data.indexOf(PostMessageEventNamesEnum.CUSTOM) > -1) {
    PostMessageListener._onCustomMessage(data, PostMessageEventNamesEnum.CUSTOM);
  } else if (data.indexOf(PostMessageEventNamesEnum.HANDSHAKE) > -1) {
    PostMessageListener._onCustomMessage(data, PostMessageEventNamesEnum.HANDSHAKE);
  } else if (data.indexOf(PostMessageEventNamesEnum.ON_BEFORE_UNLOAD) > -1) {
    PostMessageListener._onBeforeUnload(data);
  }
};

let heartBeat, tab;

// Named Class expression
class Parent {
  /**
   * Involed when object is instantiated
   * Set flags/variables and calls init method to attach event listeners
   * @param  {Object} config - Refer API/docs for config keys
   */
  constructor(config) {
    config = config || {};
    if (typeof config.heartBeatInterval === 'undefined') {
      config.heartBeatInterval = 500;
    }
    if (typeof config.shouldInitImmediately === 'undefined') {
      config.shouldInitImmediately = true;
    }
    if (typeof config.parse !== 'function') {
      config.parse = JSON.parse;
    }
    if (typeof config.stringify !== 'function') {
      config.stringify = JSON.stringify;
    }

    // reset tabs with every new Object
    tabUtils.tabs = [];

    this.Tab = Tab;
    Object.assign(this, config);

    tabUtils.config = config;

    if (this.shouldInitImmediately) {
      this.init();
    }
  }

  addInterval() {
    let i,
      tabs = tabUtils.getAll(),
      openedTabs = tabUtils.getOpened();

    // don't poll if all tabs are in CLOSED states
    if (!openedTabs || !openedTabs.length) {
      window.clearInterval(heartBeat); // stop the interval
      heartBeat = null;
      return false;
    }

    for (i = 0; i < tabs.length; i++) {
      if (this.removeClosedTabs) {
        this.watchStatus(tabs[i]);
      }
      /**
       * The check is required since tab would be removed when closed(in case of `removeClosedTabs` flag),
       * irrespective of heatbeat controller
       */
      if (tabs[i] && tabs[i].ref) {
        tabs[i].status = tabs[i].ref.closed ? TabStatusEnum.CLOSE : TabStatusEnum.OPEN;
      }
    }

    // Call the user-defined callback after every polling operation is operted in a single run
    if (this.onPollingCallback) {
      this.onPollingCallback();
    }
  }

  /**
   * Poll all tabs for their status - OPENED / CLOSED
   * An interval is created which checks for last and current status.
   * There's a property on window i.e. `closed` which returns true for the closed window.
   * And one can see `true` only in another tab when the tab was opened by the same `another` tab.
   */
  startPollingTabs() {
    heartBeat = window.setInterval(() => this.addInterval(), this.heartBeatInterval);
  }

  /**
   * Compare tab status - OPEN vs CLOSE
   * @param  {Object} tab
   */
  watchStatus(tab) {
    if (!tab || !tab.ref) {
      return false;
    }
    let newStatus = tab.ref.closed ? TabStatusEnum.CLOSE : TabStatusEnum.OPEN,
      oldStatus = tab.status;

    // If last and current status(inside a polling interval) are same, don't do anything
    if (!newStatus || newStatus === oldStatus) {
      return false;
    }

    // OPEN to CLOSE state
    if (oldStatus === TabStatusEnum.OPEN && newStatus === TabStatusEnum.CLOSE) {
      // remove tab from tabUtils
      tabUtils._remove(tab);
    }
    // Change from CLOSE to OPEN state is never gonna happen ;)
  }

  /**
   * Called when a child is refreshed/closed
   * @param  {Object} ev - Event
   */
  onChildUnload(ev) {
    if (this.onChildDisconnect) {
      this.onChildDisconnect(ev.detail);
    }
  }

  /**
   * Enable link/btn, which got disabled on clicking.
   * Note: works only when `data-tab-opener="child"` is used on the respective element
   * @param  {Object} ev - Event
   */
  customEventUnListener(ev) {
    this.enableElements();

    if (ev.detail && ev.detail.type === PostMessageEventNamesEnum.HANDSHAKE && this.onHandshakeCallback) {
      this.onHandshakeCallback(ev.detail.tabInfo);
    } else if (ev.detail && ev.detail.type === PostMessageEventNamesEnum.CUSTOM && this.onChildCommunication) {
      this.onChildCommunication(ev.detail.tabInfo);
    }
  }

  /**
   * Attach postmessage, native and custom listeners to the window
   */
  addEventListeners() {
    window.removeEventListener('message', PostMessageListener.onNewTab);
    window.addEventListener('message', PostMessageListener.onNewTab);

    window.removeEventListener('onCustomChildMessage', this.customEventUnListener);
    window.addEventListener('onCustomChildMessage', ev => this.customEventUnListener(ev));

    window.removeEventListener('onChildUnload', this.onChildUnload);
    window.addEventListener('onChildUnload', ev => this.onChildUnload(ev));

    // Let children tabs know when Parent is closed / refereshed.
    window.onbeforeunload = () => {
      tabUtils.broadCastAll(PostMessageEventNamesEnum.PARENT_DISCONNECTED);
    };
  }

  /**
   * API methods exposed for Public
   *
   * Re-enable the link/btn which got disabled on clicking
   */
  enableElements() {
    domUtils.enable('data-tab-opener');
  }

  /**
   * Return list of all tabs
   * @return {Array}
   */
  getAllTabs() {
    return tabUtils.getAll();
  }

  /**
   * Return list of all OPENED tabs
   * @return {Array}
   */
  getOpenedTabs() {
    return tabUtils.getOpened();
  }

  /**
   * Return list of all CLOSED tabs
   * @return {Array}
   */
  getClosedTabs() {
    return tabUtils.getClosed();
  }

  /**
   * Close all tabs at once
   * @return {Object}
   */
  closeAllTabs() {
    return tabUtils.closeAll();
  }

  /**
   * Close a specific tab
   * @return {Object}
   */
  closeTab(id) {
    return tabUtils.closeTab(id);
  }

  /**
   * Send a postmessage to all OPENED tabs
   * @return {Object}
   */
  broadCastAll(msg) {
    return tabUtils.broadCastAll(msg);
  }

  /**
   * Send a postmessage to a specific tab
   * @return {Object}
   */
  broadCastTo(id, msg) {
    return tabUtils.broadCastTo(id, msg);
  }

  /**
   * Open a new tab. Config has to be passed with some required keys
   * @return {Object} tab
   */
  openNewTab(config) {
    if (!config) {
      throw new Error(WarningTextEnum.CONFIG_REQUIRED);
    }

    let url = config.url;

    if (!url) {
      throw new Error(WarningTextEnum.URL_REQUIRED);
    }

    tab = new this.Tab();
    tab.create(config);

    // If polling is already there, don't set it again
    if (!heartBeat) {
      this.startPollingTabs();
    }

    return tab;
  }

  /**
   * API methods exposed for Public ends here
   **/

  /**
   * Invoked on object instantiation unless user pass a key to call it explicitly
   */
  init() {
    this.addEventListeners();
  }
}

// Named Class expression
class Child {
  /**
   * Involed when object is instantiated
   * Set flags/variables and calls init method to attach event listeners
   * @param  {Object} config - Refer API/docs for config keys
   */
  constructor(config) {
    this.sessionStorageKey = '__vwo_new_tab_info__';

    if (!config) {
      config = {};
    }
    if (typeof config.handshakeExpiryLimit === 'undefined') {
      config.handshakeExpiryLimit = 5000;
    }
    if (typeof config.shouldInitImmediately === 'undefined') {
      config.shouldInitImmediately = true;
    }
    if (typeof config.parse !== 'function') {
      config.parse = JSON.parse;
    }
    if (typeof config.stringify !== 'function') {
      config.stringify = JSON.stringify;
    }

    this.tabName = window.name;
    this.tabId = null;
    this.tabParentName = null;

    Object.assign(this, config);
    this.config = config;

    if (this.shouldInitImmediately) {
      this.init();
    }
  }

  /**
   * Check is sessionStorage is present on window
   * @return {Boolean} [description]
   */
  _isSessionStorage() {
    if ('sessionStorage' in window && window.sessionStorage) {
      return true;
    }
    return false;
  }

  /**
   * Get stored data from sessionStorage
   * @return {Object} data
   */
  _getData() {
    if (!this.isSessionStorageSupported) {
      return false;
    }

    return window.sessionStorage.getItem(this.sessionStorageKey);
  }

  /**
   * Set stored data from sessionStorage
   * @return {Object} data
   */
  _setData(dataReceived) {
    if (!this.isSessionStorageSupported) {
      return false;
    }

    window.sessionStorage.setItem(this.sessionStorageKey, dataReceived);
    return dataReceived;
  }

  /**
   * Get stored data from sessionStorage and parse it
   * @return {Object} data
   */
  _restoreData() {
    if (!this.isSessionStorageSupported) {
      return false;
    }

    if (this.isSessionStorageSupported) {
      let storedData = this._getData();

      this._parseData(storedData);
    }
  }

  /**
   * Parse data fetched from sessionStorage
   * @param  {String} dataReceived
   */
  _parseData(dataReceived) {
    let actualData;

    // Expecting JSON data
    try {
      actualData = this.config.parse(dataReceived);
      this.tabId = actualData && actualData.id;
      this.tabName = actualData && actualData.name;
      this.tabParentName = actualData && actualData.parentName;
    } catch (e) {
      throw new Error(WarningTextEnum.INVALID_DATA);
    }
  }

  /**
   * The core of this file
   * This method receives the postmessage from Parent
   * after establishing a proper communication channel between Parent tab and Child tab.
   * It removes the handshake timeout.
   * Based on the type of postmessage event, it sets/parses or calls user defined callbacks
   *
   * @param  {String} message
   */
  onCommunication(message) {
    let dataReceived,
      data = message.data;

    if (!data || typeof data !== 'string') {
      return;
    }

    // `origin` check for secureity point of view
    if (this.config.origin && this.config.origin !== message.origin) {
      return;
    }

    // cancel timeout
    window.clearTimeout(this.timeout);

    // When Parent tab gets closed or refereshed
    if (data.indexOf(PostMessageEventNamesEnum.PARENT_DISCONNECTED) > -1) {
      // Call user-defined `onParentDisconnect` callback when Parent tab gets closed or refereshed.
      if (this.config.onParentDisconnect) {
        this.config.onParentDisconnect();
      }

      // remove postMessage listener since no Parent is there to communicate with
      window.removeEventListener('message', evt => this.onCommunication(evt));
    }

    /**
     * When Parent sends an Acknowledgement to the Child's request of setting up a communication channel
     * along with the tab's identity i.e. id, name and it's parent(itself) to the child tab.
     */
    if (data.indexOf(PostMessageEventNamesEnum.HANDSHAKE_WITH_PARENT) > -1) {
      let msg;

      dataReceived = data.split(PostMessageEventNamesEnum.HANDSHAKE_WITH_PARENT)[1];

      // Set data to sessionStorage so that when page reloads it can directly read the past info till the session lives
      this._setData(dataReceived);
      this._parseData(dataReceived);

      msg = {
        id: this.tabId,
        isSiteInsideFrame: this.config.isSiteInsideFrame
      };
      this.sendMessageToParent(msg, PostMessageEventNamesEnum.HANDSHAKE);

      if (this.config.onInitialize) {
        this.config.onInitialize();
      }
    }

    // Whenever Parent tab communicates once the communication channel is established
    if (data.indexOf(PostMessageEventNamesEnum.PARENT_COMMUNICATED) > -1) {
      dataReceived = data.split(PostMessageEventNamesEnum.PARENT_COMMUNICATED)[1];

      try {
        dataReceived = this.config.parse(dataReceived);
      } catch (e) {
        throw new Error(WarningTextEnum.INVALID_JSON);
      }
      // Call user-defined `onParentCommunication` callback when Parent sends a message to Parent tab
      if (this.config.onParentCommunication) {
        this.config.onParentCommunication(dataReceived);
      }
    }
  }

  /**
   * Attach postmessage and onbeforeunload event listeners
   */
  addListeners() {
    window.onbeforeunload = evt => {
      let msg = {
        id: this.tabId,
        isSiteInsideFrame: this.config.isSiteInsideFrame
      };

      this.sendMessageToParent(msg, PostMessageEventNamesEnum.ON_BEFORE_UNLOAD);
    };

    window.removeEventListener('message', evt => this.onCommunication(evt));
    window.addEventListener('message', evt => this.onCommunication(evt));
  }

  /**
   * Call a user-defined method `onHandShakeExpiry`
   * if the Parent doesn't recieve a first handshake message within the configurable `handshakeExpiryLimit`
   * @return {Function}
   */
  setHandshakeExpiry() {
    return window.setTimeout(() => {
      if (this.config.onHandShakeExpiry) {
        this.config.onHandShakeExpiry();
      }
    }, this.handshakeExpiryLimit);
  }

  /**
   * API starts here ->
   *
   * Send a postmessage to the corresponding Parent tab
   * @param  {String} msg
=   */
  sendMessageToParent(msg, _prefixType) {
    let origin;

    let type = _prefixType || PostMessageEventNamesEnum.CUSTOM;

    msg = type + this.config.stringify(msg);

    if (window.top.opener) {
      origin = this.config.origin || '*';
      window.top.opener.postMessage(msg, origin);
    }
  }

  /**
   * Get current Tab info i.e. id, name and parentName
   * @return {Object} tab-info
   */
  getTabInfo() {
    return {
      id: this.tabId,
      name: this.tabName,
      parentName: this.tabParentName,
      isSiteInsideFrame: this.config.isSiteInsideFrame
    };
  }
  /**
   * API ends here ->
   */

  /**
   * Invoked on object instantiation unless user pass a key to call it explicitly
   */
  init() {
    this.isSessionStorageSupported = this._isSessionStorage();
    this.addListeners();
    this._restoreData();
    this.sendMessageToParent(this.getTabInfo(), PostMessageEventNamesEnum.LOADED);
    this.timeout = this.setHandshakeExpiry();

    if (this.config.onReady) {
      this.config.onReady();
    }
  }
}

/**
 * Expose Parent and Child modules on AcrossTabs Object
 * @type {Object}
 */
const AcrossTabs = {
  Parent: Parent,
  Child: Child
};

module.exports = AcrossTabs;
