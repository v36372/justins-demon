package models

type HltvAnalytics struct {
	Url string
	A   TeamAnalytics
	B   TeamAnalytics
}

type TeamAnalytics struct {
	Insight_favor   []Insight
	Insight_against []Insight
	PH2Hs           []HltvPlayerH2H
	Handicap        Handicap
	MapStats        []MapStat
}

type MapStat struct {
	MapName   string
	Played    string
	Win       string
	Winstreak string
}

type Insight struct {
	Raw string
}

type MapHandicap struct {
	MapName                string
	Avg_rnds_lost_in_wins  string
	Avg_rnds_win_in_losses string
}

type Handicap struct {
	Total_matches_played   string
	Total_maps_played      string
	Total_2_0_wins         string
	Total_2_1_wins         string
	Total_0_2_losses       string
	Total_1_2_losses       string
	Total_overtime         string
	Avg_rnds_lost_in_wins  string
	Avg_rnds_win_in_losses string
	MapsHandicap           []MapHandicap
}

type HltvPlayerH2H struct {
	Three_Months string
	Event        string
}
