
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

create table teams(
	uid serial primary key,
	id varchar(100) not null,
	name varchar(100),
	country varchar(100)
);


-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back

drop table teams;
