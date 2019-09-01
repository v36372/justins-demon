
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

create table events(
	uid serial,
	id varchar(100) primary key not null,
	name varchar(100),
	slug varchar(100),
	no_teams varchar(100),
	prize_pool varchar(100),
	event_type varchar(100),
	is_qualifier boolean,
	country varchar(100),
	unix_from varchar(100),
	unix_to varchar(100)
);


create table matches(
	uid serial, 
	id varchar(100) primary key not null,
	url text not null,
	eventid varchar(100),
	series_id varchar(100),
	series_type varchar(100),
	a varchar(100),
	b varchar(100),
	mapname varchar(100),
	a_t_pistol boolean,
	a_ct_pistol boolean,
	b_t_pistol boolean,
	b_ct_pistol boolean,
	a_f5r boolean,
	b_f5r boolean,
	a_t varchar(100),
	b_ct varchar(100),
	a_ct varchar(100),
	b_t varchar(100),
	a_rating varchar(100),
	b_rating varchar(100),
	a_fk varchar(100),
	b_fk varchar(100),
	a_cw varchar(100),
	b_cw varchar(100)
);

create table round_histories(
	uid serial primary key,
	matchid varchar(100) not null,
	total integer,
	r1 varchar(5),
	r2 varchar(5),
	r3 varchar(5),
	r4 varchar(5),
	r5 varchar(5),
	r6 varchar(5),
	r7 varchar(5),
	r8 varchar(5),
	r9 varchar(5),
	r10 varchar(5),
	r11 varchar(5),
	r12 varchar(5),
	r13 varchar(5),
	r14 varchar(5),
	r15 varchar(5),
	r16 varchar(5),
	r17 varchar(5),
	r18 varchar(5),
	r19 varchar(5),
	r20 varchar(5),
	r21 varchar(5),
	r22 varchar(5),
	r23 varchar(5),
	r24 varchar(5),
	r25 varchar(5),
	r26 varchar(5),
	r27 varchar(5),
	r28 varchar(5),
	r29 varchar(5),
	r30 varchar(5)
);

create table pps(
	uid serial,
	id varchar(100) not null,
	teamid varchar(100),
	matchid varchar(100),
	country varchar(100),
	k varchar(100),
	hs varchar(100),
	a varchar(100),
	fa varchar(100),
	d varchar(100),
	kast varchar(100),
	adr varchar(100),
	r varchar(100)
);
-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back

drop table pps;
drop table matches;
drop table events;
drop table round_histories;
