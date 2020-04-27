const MongoClient = require( 'mongodb' ).MongoClient;
require('dotenv').config()
var Honeybadger = require('honeybadger').configure({
    apiKey: process.env.HB_API_KEY
});

const assert = require("assert");

var MONGODB_URI = process.env.MONGODB_URI
if (process.env.PROD == "true")
  MONGODB_URI = process.env.PROD_MONGODB_URI

let _db;

async function initDb(callback) {
  if (_db) {
    console.warn("Trying to init DB again!");
    return callback(null, _db);
  }
  return await MongoClient.connect(MONGODB_URI, connected);

  function connected(err, db) {
    if (err) {
      return callback(err);
    }
    console.log("DB initialized - connected to: " + MONGODB_URI.split("@")[1]);
    _db = db;
    return callback(null, _db);
  }
}

function getDb() {
    assert.ok(_db, "Db has not been initialized. Please called init first.");
    return _db;
}

function errorHandler(query) {
  return function(err, res){
    if (err != null) {
      console.error("error when %s: %s", query, err)
      Honeybadger.notify(err);
    }
  }
}

module.exports = {
    getDb,
    initDb,
    errorHandler
};
