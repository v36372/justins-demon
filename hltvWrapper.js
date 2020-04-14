const { HLTV } = require('./HLTV');
require('dotenv').config();
const assert = require("assert");

const HttpsProxyAgent = require('https-proxy-agent');

var _agent;
var _myHLTV;

function errorHandler(err) {
  if (err[0] == 429)
    changeProxy(err[1])
  else
    console.error(err)
}

function changeProxy(url) {
  console.log("requests to HLTV are blocked because rate limiting: %s", url)
  var since_last_change = 0
  return function(u, m){
    if (u == 'false') return
    if (since_last_change < m) {
      since_last_change++
      console.log("increment tick proxy", since_last_change, m)
      return
    }
    since_last_change = 0

    var options = {
      host: 'api.getproxylist.com',
      port: 443,
      path: '/proxy?country=US',
      method: 'GET'
    };
    var req = https.request(options, function(resp){
      resp.on('data', function (chunk) {
        var body = JSON.parse(String(chunk));
        console.log('using proxy server %s:%d', body['ip'], body['port']);
        agent = new HttpsProxyAgent(body['ip']+":"+body['port']);
        _myHLTV.changeAgent(agent);
      });
    }).end();
  }(process.env.USE_PROXY, Number(process.env.MAX_TICK_BEFORE_CHANGE_PROXY))
}

function createHLTV(){
  console.log("creating hltv")
  _myHLTV = HLTV.createInstance({})
}

function getHLTV(){
  assert.ok(_myHLTV, "HLTV instance not initialized")

  return _myHLTV;
}

module.exports = {
    createHLTV,
    getHLTV,
    changeProxy,
    errorHandler,
};
