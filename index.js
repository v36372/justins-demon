const getHLTV = require('./hltvWrapper').getHLTV;
require('dotenv').config();

const initDb = require("./mongodbUtil").initDb;
const getDb = require("./mongodbUtil").getDb;
const startCronNewMaps = require("./cronNewMapsAndSeries").startCronScheduler;
const startCronUpdateSeries = require("./cronUpdateSeries").startCronScheduler;
const startCronCreateData = require("./cronDataMassage").startCronScheduler;
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

  app.get("/", async (req, res, next) => {
    const db = getDb().db();
    const hltv = getHLTV("");

    var totalMatches = await db.collection('matches').count()
    var stats = await db.collection('matches').find({stats: {$exists: true}}).count()
    var teamStats = await db.collection('matches').find({teams_stats: {$exists: true}}).count()
    var teamExtraStats = await db.collection('matches').find({teams_extraStats: {$exists: true}}).count()
    var teamExtraStatsPerMap = await db.collection('matches').find({teams_extraStatsPerMap: {$exists: true}}).count()
    var playerStats = await db.collection('matches').find({players_stats: {$exists: true}}).count()
    var playerExtraStats= await db.collection('matches').find({players_extra_stats: {$exists: true}}).count()
    var playerExtraStatsPerMap = await db.collection('matches').find({players_extra_stats_per_map: {$exists: true}}).count()


    res.json({
      total: totalMatches,
      stats: stats/totalMatches,
      teamStats: teamStats/totalMatches,
      teamExtraStats: teamExtraStats/totalMatches,
      teamExtraStatsPerMap: teamExtraStatsPerMap/totalMatches,
      playerStats: playerStats/totalMatches,
      playerExtraStats: playerExtraStats/totalMatches,
      playerExtraStatsPerMap: playerExtraStatsPerMap/totalMatches,
    })
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

  startCronUpdateSeries()
  startCronNewMaps()
  startCronCreateData()
});

