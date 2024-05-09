create table
    public.routepoints (
        id SERIAL primary key not null,
        route_id varchar(8) not null,
        point geometry (Point, 4326) not null,
        "order" integer,
        created_at timestamp default CURRENT_TIMESTAMP not null
    );

alter table public.routepoints owner to smo;

create index route_id_index on public.routepoints (route_id);

create index routepoints_point_index on public.routepoints using gist (point);
