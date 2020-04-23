const getHLTV = require('./hltvWrapper').getHLTV;
require('dotenv').config();

const initDb = require("./mongodbUtil").initDb;
const getDb = require("./mongodbUtil").getDb;
const startCronScheduler = require("./cron").startCronScheduler;
const eHandler = require('./hltvWrapper').errorHandler;
const errorHandler = require('./mongodbUtil').errorHandler;

const PORT = process.env.PORT || 5000

var test

const express = require("express");
var app = express();


initDb(function (err) {
  app.listen(PORT, function (err) {
    if (err) {
      throw err; //
    }
    console.log("API Up and running on port " + PORT);
  });

  app.get("/crawl-matches", (req, res, next) => {
    const db = getDb().db();
    const hltv = getHLTV("");

    hltv.getMatchesStats({startDate: req.query.startDate, endDate: req.query.endDate, rankingFilter: req.query.rankingFilter}).then((matches) => {
      matches.forEach(function(item){
        db.collection('match_maps').findOne({id: item.id}, function(err, result){
          if (result !== null) {
            console.warn("trying to insert exited map", item.id)
            return
          }
          console.log("insert new map")
          db.collection('match_maps').insertOne(item, errorHandler("inserting new maps with id = " + item.id));
        });
      })
      res.json(matches);
    }).catch(eHandler)
  });

  startCronScheduler()
});

