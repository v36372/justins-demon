const { HLTV } = require('hltv')

const myHLTV = HLTV.createInstance({})

const path = require('path')
const PORT = process.env.PORT || 5000

var test

const express = require("express");
var app = express();
app.listen(PORT, () => {
 console.log("Server running on port 5000");
});

app.get("/", (req, res, next) => {
  HLTV.getTeamStats({id: 6667}).then(teamStats => {
    res.json(teamStats);
  })
});

