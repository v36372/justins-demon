const { HLTV } = require('./HLTV');
require('dotenv').config();
const assert = require("assert");
var https = require('https') 
const fetch = require('node-fetch')

const HttpsProxyAgent = require('https-proxy-agent');

const proxyManager = function(u, m, p){
  var since_last_change = 0

  return {
    _getNewProxy: async function() {
      const response = await fetch('https://api.getproxylist.com/proxy?country=US&allowsHttps=1&protocol=http')
      const body = await response.json()
      return body['protocol'] + "://" +body['ip'] + ":" + body['port']
    },

    changeProxy: async function(oldProxy, i) {
      if (u == 'false') return oldProxy
      if (!i && since_last_change < m) {
        since_last_change++
        console.log("increment tick proxy", since_last_change, m)
        return oldProxy
      }
      since_last_change = 0
      console.log("try changing old proxy %s", oldProxy)

      if (p == 1) process.exit(1)
      return await proxyManager._getNewProxy()
    }
  }
}(process.env.USE_PROXY, Number(process.env.MAX_TICK_BEFORE_CHANGE_PROXY), process.env.PROXY_LAST_RESORT)

function getHLTV(proxy){
  return HLTV.createInstance(proxy)
}

module.exports = {
  getHLTV,
  proxyManager,
};
