const createHLTV = require('./hltvWrapper').createHLTV;
const getHLTV = require('./hltvWrapper').getHLTV;
require('dotenv').config();

const initDb = require("./mongodbUtil").initDb;
const getDb = require("./mongodbUtil").getDb;
const startCronScheduler = require("./cron").startCronScheduler;

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
    const hltv = createHLTV();
  });

  app.get("/crawl-teams", (req, res, next) => {
    const db = getDb().db();
    const hltv = getHLTV();
    hltv.getTeamExtraStats({startDate: req.query.startDate, endDate: req.query.endDate, rankingFilter: req.query.rankingFilter}).then((teams) => {
      teams.forEach(function(item){
        db.collection('teams').findOne({"team.id": item.team.id}, function(err, result){
          if (result !== null) {
            console.log("replace team stats", item.team.name, result._id)
            db.collection('teams').replaceOne({_id: result._id}, item, function(err, res) {
              if (err) {
                console.error(err)
                return
              }
            });
            return
          }
          console.log("insert new team stats", item.team.name)
          db.collection('teams').insertOne(item, errorHandler("inserting new team with id = " + item.id));
        });
      })
      res.json(teams);
    })
  });

  app.get("/crawl-matches", (req, res, next) => {
    const db = getDb().db();
    hltv.getMatchesStats({startDate: req.query.startDate, endDate: req.query.endDate, rankingFilter: req.query.rankingFilter}).then((matches) => {
      matches.forEach(function(item){
        db.collection('match_maps').findOne({id: item.id}, function(err, result){
          if (result !== null) {
            console.warn("trying to insert exited match", item.id)
            return
          }
          console.log("insert new match")
          db.collection('match_maps').insertOne(item, errorHandler("inserting new maps with id = " + item.id));
        });
      })
      res.json(matches);
    })
  });

  startCronScheduler()
});

