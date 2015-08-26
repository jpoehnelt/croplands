
CREATE OR REPLACE FUNCTION get_country() 
	RETURNS trigger
	AS 
	$get_country$
	BEGIN
		IF NEW.lat IS NULL THEN
			RAISE EXCEPTION 'lat cannot be null';
		END IF;
		IF NEW.lon IS NULL THEN
			RAISE EXCEPTION 'lon cannot be null';
		END IF;

		NEW.country := (SELECT adm0_name FROM country WHERE ST_Contains(country.geom,ST_Point(NEW.lon,NEW.lat)) LIMIT 1);
		RETURN NEW;
	END;
	$get_country$
	LANGUAGE plpgsql;

CREATE TRIGGER location_country_trigger
	BEFORE INSERT or UPDATE of lat, lon on location
	FOR EACH ROW
	EXECUTE PROCEDURE get_country();
