const { HLTV } = require('./HLTV');
require('dotenv').config();
const assert = require("assert");
var https = require('https') 

const HttpsProxyAgent = require('https-proxy-agent');

var _agent;
var _myHLTV;

function errorHandler(err) {
  if (err[0] == 429)
    changeProxy(err[1])
  else
    console.error(err)
}

var changeProxy = function(u, m) {
  var since_last_change = 0
  return function(url){
    console.log("requests to HLTV are blocked because rate limiting: %s", url)
    if (u == 'false') return
    if (since_last_change < m) {
      since_last_change++
      console.log("increment tick proxy", since_last_change, m)
      return
    }
    since_last_change = 0

    if (process.env.PROXY_LAST_RESORT == 1) process.exit(1)

    var options = {
      host: 'api.getproxylist.com',
      port: 443,
      path: '/proxy?country=US&allowsHttps=1',
      method: 'GET'
    };
    var req = https.request(options, function(resp){
      resp.on('data', function (chunk) {
        var body = JSON.parse(String(chunk));
        console.log('using proxy server %s:%d', body['ip'], body['port']);
        _myHLTV.changeProxySettings({
            host: body['ip'],
            port: body['port'],
        })
      });
    }).end();
  }
}(process.env.USE_PROXY, Number(process.env.MAX_TICK_BEFORE_CHANGE_PROXY))

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
