package main

import (
	"encoding/csv"
	"fmt"
	"justins-demon/infra"
	"justins-demon/models"
	"math/rand"
	"os"
	"reflect"
	"strconv"
	"time"

	_ "github.com/lib/pq"
)

func shuffle(a []models.Match) []models.Match {
	var currentIndex int
	currentIndex = len(a)

	s1 := rand.NewSource(time.Now().UnixNano())
	r1 := rand.New(s1)
	for currentIndex > 0 {
		randIndex := r1.Intn(currentIndex)
		currentIndex--

		temp := a[currentIndex]
		a[currentIndex] = a[randIndex]
		a[randIndex] = temp
	}

	return a
}

type feature struct {
	seriesType []string
	teamA      []string
	teamB      []string
	mapName    []string
}

type label struct {
	winner string
	uo     string
}

func oneHotEncodeSeriesType(value string) []string {
	switch value {
	case "bo1":
		return []string{"1", "0", "0", "0"}
	case "bo2":
		return []string{"0", "1", "0", "0"}
	case "bo3":
		return []string{"0", "0", "1", "0"}
	case "bo5":
		return []string{"0", "0", "0", "1"}
	}

	return []string{}
}

func oneHotEncodeTeam(value string, teams []models.Team, teamIdMap map[string]int) ([]string, bool) {
	if _, ok := teamIdMap[value]; !ok {
		return []string{}, false
	}

	teamFeature := make([]string, len(teams))
	for i := range teamFeature {
		teamFeature[i] = "0"
	}

	teamFeature[teamIdMap[value]-1] = "1"
	return teamFeature, true
}

func oneHotEncodeMap(value string, mapNamemap map[string]int) []string {
	mapFeature := make([]string, 9)
	for i := range mapFeature {
		mapFeature[i] = "0"
	}
	mapFeature[mapNamemap[value]] = "1"
	return mapFeature
}

func oneHotEncodeWinner(m models.Match) []string {
	if m.A_t+m.A_ct > m.B_t+m.B_ct {
		return []string{"1"}
	}

	return []string{"0"}
}

func genDataset() {
	matches := []models.Match{}
	teamids := []string{
		"5973",
		"9565",
		"6665",
		"4869",
		"6673",
		"6667",
		"4608",
		"5995",
		"8297",
		"4494",
		"4411",
		"7433",
		"4991",
		"9215",
		"7175",
		"10150",
		"6211",
		"4602",
		"5752",
		"6615",
		"9928",
		"7532",
		"8513",
		"8637",
		"5005",
		"7020",
		"8120",
		"6685",
		"8008",
		"5378",
	}
	infra.PostgreSql.Model(models.Match{}).Where("a in (?)", teamids).Where("b in (?)", teamids).Find(&matches)

	dataFile, _ := os.Create("./data.csv")

	dataWriter := csv.NewWriter(dataFile)

	for _, t := range matches {
		record := []string{}

		event := models.Event{}
		infra.PostgreSql.Model(models.Event{}).Where("id = ?", t.Eventid).Find(&event)
		event.Massage()

		qualifier_a := models.TeamsFromQualifier{}
		infra.PostgreSql.Model(models.Round_history{}).Where("event_id = ?", t.Eventid).Where("team_id = ?", t.A).Find(&qualifier_a)
		qualifier_b := models.TeamsFromQualifier{}
		infra.PostgreSql.Model(models.Round_history{}).Where("event_id = ?", t.Eventid).Where("team_id = ?", t.B).Find(&qualifier_b)

		a_past_matches := []models.Match{}
		infra.PostgreSql.Model(models.Match{}).Where("(a = ? and b != ?) or (a != ? and b = ?)", t.A, t.B, t.B, t.A).Where("id < ?", t.Id).Order("id desc").Limit(3).Find(&a_past_matches)

		b_past_matches := []models.Match{}
		infra.PostgreSql.Model(models.Match{}).Where("(a = ? and b != ?) or (a != ? and b = ?)", t.B, t.A, t.A, t.B).Where("id < ?", t.Id).Order("id desc").Limit(3).Find(&b_past_matches)

		pps := []models.Pp{}
		roundHistory := models.Round_history{}

		if len(a_past_matches) != 3 {
			continue
		}
		if len(b_past_matches) != 3 {
			continue
		}
		var v reflect.Value
		for _, am := range a_past_matches {
			v = reflect.ValueOf(am)
			for i := 0; i < v.NumField(); i++ {
				shit, ok := v.Field(i).Interface().(string)
				if !ok {
					shit = strconv.FormatBool(v.Field(i).Bool())
				}
				record = append(record, shit)
			}

			infra.PostgreSql.Model(models.Pp{}).Where("matchid = ?", am.Id).Where("teamid = ?", t.A).Order("id, adr desc").Limit(5).Find(&pps)
			for _, pp := range pps {
				v = reflect.ValueOf(pp)
				for i := 0; i < v.NumField(); i++ {
					shit, _ := v.Field(i).Interface().(string)
					record = append(record, shit)
				}
			}

			infra.PostgreSql.Model(models.Round_history{}).Where("matchid = ?", am.Id).Find(&roundHistory)
			v = reflect.ValueOf(roundHistory)
			for i := 0; i < v.NumField(); i++ {
				shit, ok := v.Field(i).Interface().(string)
				if !ok {
					shit = strconv.Itoa(v.Field(i).Interface().(int))
				}
				record = append(record, shit)
			}
		}

		for _, bm := range b_past_matches {
			v = reflect.ValueOf(bm)
			for i := 0; i < v.NumField(); i++ {
				shit, ok := v.Field(i).Interface().(string)
				if !ok {
					shit = strconv.FormatBool(v.Field(i).Bool())
				}
				record = append(record, shit)
			}

			infra.PostgreSql.Model(models.Pp{}).Where("matchid = ?", bm.Id).Where("teamid = ?", t.B).Order("id, adr desc").Limit(5).Find(&pps)
			for _, pp := range pps {
				v = reflect.ValueOf(pp)
				for i := 0; i < v.NumField(); i++ {
					shit, _ := v.Field(i).Interface().(string)
					record = append(record, shit)
				}
			}

			infra.PostgreSql.Model(models.Round_history{}).Where("matchid = ?", bm.Id).Find(&roundHistory)
			v = reflect.ValueOf(roundHistory)
			for i := 0; i < v.NumField(); i++ {
				shit, ok := v.Field(i).Interface().(string)
				if !ok {
					shit = strconv.Itoa(v.Field(i).Interface().(int))
				}
				record = append(record, shit)
			}
		}

		if qualifier_a.TeamId != "" {
			record = append(record, "True")
		} else {
			record = append(record, "False")
		}
		if qualifier_b.TeamId != "" {
			record = append(record, "True")
		} else {
			record = append(record, "False")
		}

		v = reflect.ValueOf(event)
		for i := 0; i < v.NumField(); i++ {
			shit, ok := v.Field(i).Interface().(string)
			if !ok {
				shit = strconv.FormatBool(v.Field(i).Bool())
			}
			record = append(record, shit)
		}

		v = reflect.ValueOf(t)
		for i := 0; i < v.NumField(); i++ {
			shit, ok := v.Field(i).Interface().(string)
			if !ok {
				shit = strconv.FormatBool(v.Field(i).Bool())
			}
			record = append(record, shit)
		}

		// v = reflect.ValueOf(roundHistory)
		// for i := 0; i < v.NumField(); i++ {
		// 	shit, _ := v.Field(i).Interface().(string)
		// 	record = append(record, shit)

		// }

		// for _, pp := range pps {
		// 	v = reflect.ValueOf(pp)
		// 	for i := 0; i < v.NumField(); i++ {
		// 		shit, _ := v.Field(i).Interface().(string)
		// 		record = append(record, shit)
		// 	}
		// }

		dataWriter.Write(record)
	}

	dataFile.Close()
}

func genDatasetPredictOneMatch() {
	matches := []models.Match{}
	infra.PostgreSql.Model(models.Match{}).Find(&matches)
	matches = shuffle(matches)

	teams := []models.Team{}
	teamIdMap := map[string]int{}
	infra.PostgreSql.Model(models.Team{}).Find(&teams)
	header := []string{}
	for _, t := range teams {
		teamIdMap[t.Id] = t.Uid
		header = append(header, "team_A_"+t.Name)
	}

	for _, t := range teams {
		header = append(header, "team_B_"+t.Name)
	}

	mapNamemap := map[string]int{
		"Cobblestone": 0,
		"Inferno":     1,
		"Mirage":      2,
		"Train":       3,
		"Overpass":    4,
		"Dust2":       5,
		"Cache":       6,
		"Nuke":        7,
		"Vertigo":     8,
	}

	for k, _ := range mapNamemap {
		header = append(header, "map_"+k)
	}

	header = append(header, "winner")

	dataFile, _ := os.Create("./data.csv")

	dataWriter := csv.NewWriter(dataFile)
	dataWriter.Write(header)

	for _, t := range matches {
		record := []string{}
		// record = append(record, oneHotEncodeSeriesType(t.SeriesType)...)
		teamFeature, ok := oneHotEncodeTeam(t.A, teams, teamIdMap)
		if !ok {
			continue
		}
		record = append(record, teamFeature...)
		teamFeature, ok = oneHotEncodeTeam(t.B, teams, teamIdMap)
		if !ok {
			continue
		}
		record = append(record, teamFeature...)
		record = append(record, oneHotEncodeMap(t.Mapname, mapNamemap)...)
		fmt.Println(len(record))
		fmt.Println(oneHotEncodeMap(t.Mapname, mapNamemap))
		record = append(record, oneHotEncodeWinner(t)...)
		if len(record) != 176 {
			continue
		}
		dataWriter.Write(record)
	}

	dataFile.Close()
}

func main() {
	infra.InitPostgreSQL()
	genDataset()
}
