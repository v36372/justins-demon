
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

create table coming_matches(
	id serial primary key,
	link varchar(100),
	a int,
	b int,
	a_players_stats varchar,
	b_players_stats varchar,
	map_stats varchar,
	a_past_matches varchar,
	b_past_matches varchar,
	created_at timestamptz not null default current_timestamp
);


-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back

drop table coming_matches;

