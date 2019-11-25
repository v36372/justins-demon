package models

import "regexp"

type Team struct {
	Uid     int `gorm:"PRIMARY_KEY;AUTO_INCREMENT"`
	Id      string
	Name    string
	Country string
}

type Event struct {
	Name        string
	Id          string
	Slug        string
	NoTeams     string
	PrizePool   string
	IsQualifier bool
	EventType   string
	Country     string
	UnixFrom    string
	UnixTo      string
}

type SeriesOdds struct {
	SeriesId string
	A_Win    string
	B_Win    string
}

type TeamsFromQualifier struct {
	EventId string
	TeamId  string
}

func (e *Event) Massage() {
	r, _ := regexp.Compile("Qualifier")
	e.IsQualifier = r.MatchString(e.Name)
	r, _ = regexp.Compile("[^0-9]")
	e.PrizePool = r.ReplaceAllString(e.PrizePool, "")
	e.NoTeams = r.ReplaceAllString(e.NoTeams, "")
}

type Pp struct {
	Matchid string
	Teamid  string
	Country string
	Id      string
	K       string
	Hs      string
	A       string
	Fa      string
	D       string
	Kast    string
	Adr     string
	R       string
}

type Round_history struct {
	Matchid string
	Total   int
	R1      string
	R2      string
	R3      string
	R4      string
	R5      string
	R6      string
	R7      string
	R8      string
	R9      string
	R10     string
	R11     string
	R12     string
	R13     string
	R14     string
	R15     string
	R16     string
	R17     string
	R18     string
	R19     string
	R20     string
	R21     string
	R22     string
	R23     string
	R24     string
	R25     string
	R26     string
	R27     string
	R28     string
	R29     string
	R30     string
}

type Match struct {
	Id          string
	SeriesId    string
	Url         string
	SeriesType  string
	Eventid     string
	A           string
	B           string
	Mapname     string
	A_f5r       bool
	B_f5r       bool
	A_t_pistol  bool
	A_ct_pistol bool
	B_t_pistol  bool
	B_ct_pistol bool
	A_t         string
	B_ct        string
	A_ct        string
	B_t         string
	A_rating    string
	B_rating    string
	A_fk        string
	B_fk        string
	A_cw        string
	B_cw        string
	Pp_a1       Pp
	Pp_a2       Pp
	Pp_a3       Pp
	Pp_a4       Pp
	Pp_a5       Pp
	Pp_b1       Pp
	Pp_b2       Pp
	Pp_b3       Pp
	Pp_b4       Pp
	Pp_b5       Pp
}

type MatchOdd struct {
	Id        int
	Link      string
	A         string
	B         string
	AId       int
	BId       int
	OddsA     string
	OddsB     string
	AverageA  float32
	AverageB  float32
	KellyA    float32
	KellyB    float32
	Finished  bool
	Won       bool
	BetOnA    bool
	ScoreA    int
	ScoreB    int
	Amount    float32
	PlayedOdd float32
}

type Balance struct {
	Id    int
	Total float32
}

type ComingMatch struct {
	Id            int
	Link          string
	A             int
	B             int
	APlayersStats string
	BPlayersStats string
	MapStats      string
	APastMatches  string
	BPastMatches  string
}

type Datapoint struct {
	Id             int
	SeriesId       string
	Url            string
	SeriesType     string
	A              string
	B              string
	Mapname        string
	A_f5r          bool
	B_f5r          bool
	A_t_pistol     bool
	A_ct_pistol    bool
	B_t_pistol     bool
	B_ct_pistol    bool
	A_t            string
	B_ct           string
	A_ct           string
	B_t            string
	Match_a1       Match
	Match_a2       Match
	Match_a3       Match
	Match_a4       Match
	Match_a5       Match
	Match_b1       Match
	Match_b2       Match
	Match_b3       Match
	Match_b4       Match
	Match_b5       Match
	Match_a_map_1  Match
	Match_a_map_2  Match
	Match_a_map_3  Match
	Match_b_map_1  Match
	Match_b_map_2  Match
	Match_b_map_3  Match
	Match_a_vs_b_1 Match
	Match_a_vs_b_2 Match
	Match_a_vs_b_3 Match
}
