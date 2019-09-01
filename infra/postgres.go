package infra

import (
	"fmt"
	"os"

	"github.com/jinzhu/gorm"
)

var PostgreSql *gorm.DB

func InitPostgreSQL(heroku bool) {
	source := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		"postgres",
		"postgres",
		"0.0.0.0",
		5432,
		"postgres",
	)
	var err error
	if heroku {
		source = os.Getenv("DATABASE_URL")
	}
	PostgreSql, err = gorm.Open("postgres", source)
	if err != nil {
		panic(err)

	}
	err = PostgreSql.DB().Ping()
	if err != nil {
		panic(err)

	}

	PostgreSql.LogMode(true)

}
