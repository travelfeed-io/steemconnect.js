import fetch from 'cross-fetch';
import { encodeTx, encodeOps, encodeOp } from 'steem-uri';

const BASE_URL = 'https://steemconnect.com';
const BETA_URL = 'https://beta.steemconnect.com';
const API_URL = 'https://api.steemconnect.com';

const isBrowser = () => typeof window !== 'undefined' && window;

const hasChromeExtension = () => isBrowser() && window._steemconnect && !window.steem_keychain;

const hasSteemKeychain = () => isBrowser() && window.steem_keychain;

const useSteemKeychain = () => hasSteemKeychain();

const sendTransaction = (tx, params, cb) => {
  const uri = encodeTx(tx, params);
  const webUrl = uri.replace('steem://', `${BETA_URL}/`);
  if (hasChromeExtension()) return window._steemconnect.sign(uri, cb);
  if (cb && isBrowser()) {
    const win = window.open(webUrl, '_blank');
    return win.focus();
  }
  return webUrl;
};

const sendOperations = (ops, params, cb) => {
  const uri = encodeOps(ops, params);
  const webUrl = uri.replace('steem://', `${BETA_URL}/`);
  if (hasChromeExtension()) return window._steemconnect.sign(uri, cb);
  if (cb && isBrowser()) {
    const win = window.open(webUrl, '_blank');
    return win.focus();
  }
  return webUrl;
};

const sendOperation = (op, params, cb) => {
  const uri = encodeOp(op, params);
  const webUrl = uri.replace('steem://', `${BETA_URL}/`);
  if (hasChromeExtension()) return window._steemconnect.sign(uri, cb);
  if (cb && isBrowser()) {
    const win = window.open(webUrl, '_blank');
    return win.focus();
  }
  return webUrl;
};

class Client {
  constructor(config) {
    this.apiURL = config.apiURL || API_URL;
    this.app = config.app;
    this.callbackURL = config.callbackURL;
    this.accessToken = config.accessToken;
    this.scope = config.scope || [];
    this.responseType = config.responseType;
  }

  setBaseURL() {
    console.warn(
      'The function "setBaseUrl" is deprecated, the base URL is always "https://steemconnect.com", you can only change the API URL with "setApiURL"',
    );
    return this;
  }

  setApiURL(url) {
    this.apiURL = url;
    return this;
  }

  setApp(app) {
    this.app = app;
    return this;
  }

  setCallbackURL(url) {
    this.callbackURL = url;
    return this;
  }

  setAccessToken(accessToken) {
    this.accessToken = accessToken;
    return this;
  }

  removeAccessToken() {
    delete this.accessToken;
    return this;
  }

  setScope(scope) {
    this.scope = scope;
    return this;
  }

  getLoginURL(state) {
    const redirectUri = encodeURIComponent(this.callbackURL);
    let loginURL = `${BASE_URL}/oauth2/authorize?client_id=${this.app}&redirect_uri=${redirectUri}`;
    if (this.responseType === 'code') loginURL += `&response_type=${this.responseType}`;
    if (this.scope) loginURL += `&scope=${this.scope.join(',')}`;
    if (state) loginURL += `&state=${encodeURIComponent(state)}`;
    return loginURL;
  }

  login(options, cb) {
    if (hasChromeExtension()) {
      const params = {};
      if (this.app) params.app = this.app;
      if (options.authority) params.authority = options.authority;
      window._steemconnect.login(params, cb);
    } else if (hasSteemKeychain() && options.username) {
      const signedMessageObj = { type: 'login' };
      if (this.app) signedMessageObj.app = this.app;
      const timestamp = parseInt(new Date().getTime() / 1000, 10);
      const messageObj = {
        signed_message: signedMessageObj,
        authors: [options.username],
        timestamp,
      };
      window.steem_keychain.requestSignBuffer(
        options.username,
        JSON.stringify(messageObj),
        'Posting',
        response => {
          if (response.error) return cb(response.error);
          messageObj.signatures = [response.result];
          const token = btoa(JSON.stringify(messageObj));
          return cb(null, token);
        },
      );
    } else if (isBrowser()) {
      window.location = this.getLoginURL(options.state);
    }
  }

  send(route, method, body, cb) {
    const url = `${this.apiURL}/api/${route}`;
    const promise = fetch(url, {
      method,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        Authorization: this.accessToken,
      },
      body: JSON.stringify(body),
    })
      .then(res => {
        const json = res.json();
        if (res.status !== 200) {
          return json.then(result => Promise.reject(result));
        }
        return json;
      })
      .then(res => {
        if (res.error) {
          return Promise.reject(res);
        }
        return res;
      });

    if (!cb) return promise;

    return promise.then(res => cb(null, res)).catch(err => cb(err, null));
  }

  me(cb) {
    return this.send('me', 'POST', {}, cb);
  }

  broadcast(operations, cb) {
    if (hasChromeExtension()) {
      const uri = encodeOps(operations);
      return window._steemconnect.sign(uri, cb);
    }
    return this.send('broadcast', 'POST', { operations }, cb);
  }

  vote(voter, author, permlink, weight, cb) {
    if (useSteemKeychain()) {
      return window.steem_keychain.requestVote(voter, permlink, author, weight, response => {
        if (response.error) return cb(response.error);
        return cb(null, response);
      });
    }
    const params = {
      voter,
      author,
      permlink,
      weight,
    };
    return this.broadcast([['vote', params]], cb);
  }

  comment(parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata, cb) {
    if (useSteemKeychain()) {
      return window.steem_keychain.requestPost(
        author,
        title,
        body,
        parentPermlink,
        parentAuthor,
        jsonMetadata,
        permlink,
        '',
        response => {
          if (response.error) return cb(response.error);
          return cb(null, response);
        },
      );
    }
    const params = {
      parent_author: parentAuthor,
      parent_permlink: parentPermlink,
      author,
      permlink,
      title,
      body,
      json_metadata: JSON.stringify(jsonMetadata),
    };
    return this.broadcast([['comment', params]], cb);
  }

  deleteComment(author, permlink, cb) {
    const params = {
      author,
      permlink,
    };
    return this.broadcast([['delete_comment', params]], cb);
  }

  customJson(requiredAuths, requiredPostingAuths, id, json, cb) {
    if (useSteemKeychain()) {
      return window.steem_keychain.requestCustomJson(
        requiredPostingAuths[0],
        id,
        'Posting',
        json,
        '',
        response => {
          if (response.error) return cb(response.error);
          return cb(null, response);
        },
      );
    }
    const params = {
      required_auths: requiredAuths,
      required_posting_auths: requiredPostingAuths,
      id,
      json,
    };
    return this.broadcast([['custom_json', params]], cb);
  }

  reblog(account, author, permlink, cb) {
    const json = ['reblog', { account, author, permlink }];
    return this.customJson([], [account], 'follow', JSON.stringify(json), cb);
  }

  follow(follower, following, cb) {
    const json = ['follow', { follower, following, what: ['blog'] }];
    return this.customJson([], [follower], 'follow', JSON.stringify(json), cb);
  }

  unfollow(unfollower, unfollowing, cb) {
    const json = ['follow', { follower: unfollower, following: unfollowing, what: [] }];
    return this.customJson([], [unfollower], 'follow', JSON.stringify(json), cb);
  }

  ignore(follower, following, cb) {
    const json = ['follow', { follower, following, what: ['ignore'] }];
    return this.customJson([], [follower], 'follow', JSON.stringify(json), cb);
  }

  claimRewardBalance(account, rewardSteem, rewardSbd, rewardVests, cb) {
    const params = {
      account,
      reward_steem: rewardSteem,
      reward_sbd: rewardSbd,
      reward_vests: rewardVests,
    };
    return this.broadcast([['claim_reward_balance', params]], cb);
  }

  revokeToken(cb) {
    return this.send('oauth2/token/revoke', 'POST', { token: this.accessToken }, cb).then(() =>
      this.removeAccessToken(),
    );
  }

  updateUserMetadata(metadata = {}, cb) {
    console.warn('The function "updateUserMetadata" is deprecated.');
    return this.send('me', 'PUT', { user_metadata: metadata }, cb);
  }
}

const Initialize = config => {
  console.warn('The function "Initialize" is deprecated, please use the class "Client" instead.');
  return new Client(config);
};

const sign = (name, params, redirectUri) => {
  console.warn('The function "sign" is deprecated.');
  if (typeof name !== 'string' || typeof params !== 'object') {
    return {
      error: 'invalid_request',
      error_description: 'Request has an invalid format',
    };
  }
  let url = `${BASE_URL}/sign/${name}?`;
  url += Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  url += redirectUri ? `&redirect_uri=${encodeURIComponent(redirectUri)}` : '';
  return url;
};

export default {
  Client,
  Initialize,
  sign,
  sendTransaction,
  sendOperations,
  sendOperation,
  hasChromeExtension,
  hasSteemKeychain,
  useSteemKeychain,
};
