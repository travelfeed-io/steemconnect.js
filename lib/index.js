'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _crossFetch = require('cross-fetch');

var _crossFetch2 = _interopRequireDefault(_crossFetch);

var _steemUri = require('steem-uri');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var BASE_URL = 'https://steemconnect.com';
var BETA_URL = 'https://beta.steemconnect.com';
var API_URL = 'https://api.steemconnect.com';

var isBrowser = function isBrowser() {
  return typeof window !== 'undefined' && window;
};

var hasChromeExtension = function hasChromeExtension() {
  return isBrowser() && window._steemconnect;
};

var hasSteemKeychain = function hasSteemKeychain() {
  return isBrowser() && window.steem_keychain;
};

var useSteemKeychain = function useSteemKeychain() {
  return hasSteemKeychain();
};

var sendTransaction = function sendTransaction(tx, params, cb) {
  var uri = (0, _steemUri.encodeTx)(tx, params);
  var webUrl = uri.replace('steem://', BETA_URL + '/');
  if (hasChromeExtension()) return window._steemconnect.sign(uri, cb);
  if (cb && isBrowser()) {
    var win = window.open(webUrl, '_blank');
    return win.focus();
  }
  return webUrl;
};

var sendOperations = function sendOperations(ops, params, cb) {
  var uri = (0, _steemUri.encodeOps)(ops, params);
  var webUrl = uri.replace('steem://', BETA_URL + '/');
  if (hasChromeExtension()) return window._steemconnect.sign(uri, cb);
  if (cb && isBrowser()) {
    var win = window.open(webUrl, '_blank');
    return win.focus();
  }
  return webUrl;
};

var sendOperation = function sendOperation(op, params, cb) {
  var uri = (0, _steemUri.encodeOp)(op, params);
  var webUrl = uri.replace('steem://', BETA_URL + '/');
  if (hasChromeExtension()) return window._steemconnect.sign(uri, cb);
  if (cb && isBrowser()) {
    var win = window.open(webUrl, '_blank');
    return win.focus();
  }
  return webUrl;
};

var Client = function () {
  function Client(config) {
    (0, _classCallCheck3.default)(this, Client);

    this.apiURL = config.apiURL || API_URL;
    this.app = config.app;
    this.callbackURL = config.callbackURL;
    this.accessToken = config.accessToken;
    this.scope = config.scope || [];
    this.responseType = config.responseType;
  }

  (0, _createClass3.default)(Client, [{
    key: 'setBaseURL',
    value: function setBaseURL() {
      console.warn('The function "setBaseUrl" is deprecated, the base URL is always "https://steemconnect.com", you can only change the API URL with "setApiURL"');
      return this;
    }
  }, {
    key: 'setApiURL',
    value: function setApiURL(url) {
      this.apiURL = url;
      return this;
    }
  }, {
    key: 'setApp',
    value: function setApp(app) {
      this.app = app;
      return this;
    }
  }, {
    key: 'setCallbackURL',
    value: function setCallbackURL(url) {
      this.callbackURL = url;
      return this;
    }
  }, {
    key: 'setAccessToken',
    value: function setAccessToken(accessToken) {
      this.accessToken = accessToken;
      return this;
    }
  }, {
    key: 'removeAccessToken',
    value: function removeAccessToken() {
      delete this.accessToken;
      return this;
    }
  }, {
    key: 'setScope',
    value: function setScope(scope) {
      this.scope = scope;
      return this;
    }
  }, {
    key: 'getLoginURL',
    value: function getLoginURL(state) {
      var redirectUri = encodeURIComponent(this.callbackURL);
      var loginURL = BASE_URL + '/oauth2/authorize?client_id=' + this.app + '&redirect_uri=' + redirectUri;
      if (this.responseType === 'code') loginURL += '&response_type=' + this.responseType;
      if (this.scope) loginURL += '&scope=' + this.scope.join(',');
      if (state) loginURL += '&state=' + encodeURIComponent(state);
      return loginURL;
    }
  }, {
    key: 'login',
    value: function login(options, cb) {
      if (hasChromeExtension()) {
        var params = {};
        if (this.app) params.app = this.app;
        if (options.authority) params.authority = options.authority;
        window._steemconnect.login(params, cb);
      } else if (hasSteemKeychain() && options.username) {
        var signedMessageObj = { type: 'login' };
        if (this.app) signedMessageObj.app = this.app;
        var timestamp = parseInt(new Date().getTime() / 1000, 10);
        var messageObj = {
          signed_message: signedMessageObj,
          authors: [options.username],
          timestamp: timestamp
        };
        window.steem_keychain.requestSignBuffer(options.username, (0, _stringify2.default)(messageObj), 'Posting', function (response) {
          if (response.error) return cb(response.error);
          messageObj.signatures = [response.result];
          var token = btoa((0, _stringify2.default)(messageObj));
          return cb(null, token);
        });
      } else if (isBrowser()) {
        window.location = this.getLoginURL(options.state);
      }
    }
  }, {
    key: 'send',
    value: function send(route, method, body, cb) {
      var url = this.apiURL + '/api/' + route;
      var promise = (0, _crossFetch2.default)(url, {
        method: method,
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          Authorization: this.accessToken
        },
        body: (0, _stringify2.default)(body)
      }).then(function (res) {
        var json = res.json();
        if (res.status !== 200) {
          return json.then(function (result) {
            return _promise2.default.reject(result);
          });
        }
        return json;
      }).then(function (res) {
        if (res.error) {
          return _promise2.default.reject(res);
        }
        return res;
      });

      if (!cb) return promise;

      return promise.then(function (res) {
        return cb(null, res);
      }).catch(function (err) {
        return cb(err, null);
      });
    }
  }, {
    key: 'me',
    value: function me(cb) {
      return this.send('me', 'POST', {}, cb);
    }
  }, {
    key: 'broadcast',
    value: function broadcast(operations, cb) {
      if (hasChromeExtension()) {
        var uri = (0, _steemUri.encodeOps)(operations);
        return window._steemconnect.sign(uri, cb);
      }
      return this.send('broadcast', 'POST', { operations: operations }, cb);
    }
  }, {
    key: 'vote',
    value: function vote(voter, author, permlink, weight, cb) {
      if (useSteemKeychain()) {
        return window.steem_keychain.requestVote(voter, permlink, author, weight, function (response) {
          if (response.error) return cb(response.error);
          return cb(null, response);
        });
      }
      var params = {
        voter: voter,
        author: author,
        permlink: permlink,
        weight: weight
      };
      return this.broadcast([['vote', params]], cb);
    }
  }, {
    key: 'comment',
    value: function comment(parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata, cb) {
      if (useSteemKeychain()) {
        return window.steem_keychain.requestPost(author, title, body, parentPermlink, parentAuthor, jsonMetadata, permlink, '', function (response) {
          if (response.error) return cb(response.error);
          return cb(null, response);
        });
      }
      var params = {
        parent_author: parentAuthor,
        parent_permlink: parentPermlink,
        author: author,
        permlink: permlink,
        title: title,
        body: body,
        json_metadata: (0, _stringify2.default)(jsonMetadata)
      };
      return this.broadcast([['comment', params]], cb);
    }
  }, {
    key: 'deleteComment',
    value: function deleteComment(author, permlink, cb) {
      var params = {
        author: author,
        permlink: permlink
      };
      return this.broadcast([['delete_comment', params]], cb);
    }
  }, {
    key: 'customJson',
    value: function customJson(requiredAuths, requiredPostingAuths, id, json, cb) {
      if (useSteemKeychain()) {
        return window.steem_keychain.requestCustomJson(requiredPostingAuths[0], id, 'Posting', json, '', function (response) {
          if (response.error) return cb(response.error);
          return cb(null, response);
        });
      }
      var params = {
        required_auths: requiredAuths,
        required_posting_auths: requiredPostingAuths,
        id: id,
        json: json
      };
      return this.broadcast([['custom_json', params]], cb);
    }
  }, {
    key: 'reblog',
    value: function reblog(account, author, permlink, cb) {
      var json = ['reblog', { account: account, author: author, permlink: permlink }];
      return this.customJson([], [account], 'follow', (0, _stringify2.default)(json), cb);
    }
  }, {
    key: 'follow',
    value: function follow(follower, following, cb) {
      var json = ['follow', { follower: follower, following: following, what: ['blog'] }];
      return this.customJson([], [follower], 'follow', (0, _stringify2.default)(json), cb);
    }
  }, {
    key: 'unfollow',
    value: function unfollow(unfollower, unfollowing, cb) {
      var json = ['follow', { follower: unfollower, following: unfollowing, what: [] }];
      return this.customJson([], [unfollower], 'follow', (0, _stringify2.default)(json), cb);
    }
  }, {
    key: 'ignore',
    value: function ignore(follower, following, cb) {
      var json = ['follow', { follower: follower, following: following, what: ['ignore'] }];
      return this.customJson([], [follower], 'follow', (0, _stringify2.default)(json), cb);
    }
  }, {
    key: 'claimRewardBalance',
    value: function claimRewardBalance(account, rewardSteem, rewardSbd, rewardVests, cb) {
      var params = {
        account: account,
        reward_steem: rewardSteem,
        reward_sbd: rewardSbd,
        reward_vests: rewardVests
      };
      return this.broadcast([['claim_reward_balance', params]], cb);
    }
  }, {
    key: 'revokeToken',
    value: function revokeToken(cb) {
      var _this = this;

      return this.send('oauth2/token/revoke', 'POST', { token: this.accessToken }, cb).then(function () {
        return _this.removeAccessToken();
      });
    }
  }, {
    key: 'updateUserMetadata',
    value: function updateUserMetadata() {
      var metadata = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var cb = arguments[1];

      console.warn('The function "updateUserMetadata" is deprecated.');
      return this.send('me', 'PUT', { user_metadata: metadata }, cb);
    }
  }]);
  return Client;
}();

var Initialize = function Initialize(config) {
  console.warn('The function "Initialize" is deprecated, please use the class "Client" instead.');
  return new Client(config);
};

var sign = function sign(name, params, redirectUri) {
  console.warn('The function "sign" is deprecated.');
  if (typeof name !== 'string' || (typeof params === 'undefined' ? 'undefined' : (0, _typeof3.default)(params)) !== 'object') {
    return {
      error: 'invalid_request',
      error_description: 'Request has an invalid format'
    };
  }
  var url = BASE_URL + '/sign/' + name + '?';
  url += (0, _keys2.default)(params).map(function (key) {
    return key + '=' + encodeURIComponent(params[key]);
  }).join('&');
  url += redirectUri ? '&redirect_uri=' + encodeURIComponent(redirectUri) : '';
  return url;
};

exports.default = {
  Client: Client,
  Initialize: Initialize,
  sign: sign,
  sendTransaction: sendTransaction,
  sendOperations: sendOperations,
  sendOperation: sendOperation,
  hasChromeExtension: hasChromeExtension,
  hasSteemKeychain: hasSteemKeychain,
  useSteemKeychain: useSteemKeychain
};
module.exports = exports['default'];