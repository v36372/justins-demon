
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

create table teams_from_qualifiers(
	uid serial primary key,
	event_id varchar(100),
	team_id varchar(100)
);

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back

drop table teams_from_qualifiers;
