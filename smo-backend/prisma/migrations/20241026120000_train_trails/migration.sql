create table public.traintrails (
    id SERIAL PRIMARY KEY NOT NULL,
    train_id VARCHAR(24) NOT NULL,
    speed float NOT NULL,
    creator VARCHAR(40) NOT NULL,
    point geometry (Point, 4326) NOT NULL,
    created_at timestamp default CURRENT_TIMESTAMP NOT NULL
);

create index train_id_index on public.traintrails (train_id);

create index traintrails_point_index on public.traintrails using gist (point);

alter table
    stats
alter column
    service_id type varchar(17) using service_id :: varchar(17);
