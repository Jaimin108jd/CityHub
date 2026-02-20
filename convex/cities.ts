import { action } from "./_generated/server";
import { v } from "convex/values";

export const searchCities = action({
    args: { query: v.string() },
    handler: async (ctx, args) => {
        if (!args.query || args.query.trim().length < 2) {
            return [];
        }

        try {
            // Using Nominatim (OpenStreetMap) for free geocoding
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                    new URLSearchParams({
                        q: args.query,
                        format: "json",
                        addressdetails: "1",
                        limit: "10",
                        featureType: "city",
                    }),
                {
                    headers: {
                        "User-Agent": "CityHub-App/1.0",
                    },
                }
            );

            if (!response.ok) {
                console.error("Nominatim API error:", response.status);
                return [];
            }

            const data = await response.json();

            // Filter and format city results
            const cities = data
                .filter((place: any) => {
                    // Only include cities, towns, and municipalities
                    const validTypes = [
                        "city",
                        "town",
                        "municipality",
                        "village",
                        "administrative",
                    ];
                    return (
                        place.type &&
                        validTypes.some((type) =>
                            place.type.toLowerCase().includes(type)
                        )
                    );
                })
                .map((place: any) => {
                    const address = place.address || {};
                    const cityName =
                        address.city ||
                        address.town ||
                        address.village ||
                        address.municipality ||
                        place.name;

                    return {
                        name: cityName,
                        country: address.country || "Unknown",
                        state: address.state || address.province || undefined,
                        lat: parseFloat(place.lat),
                        lon: parseFloat(place.lon),
                        displayName: place.display_name,
                    };
                })
                // Remove duplicates based on city name + country
                .filter(
                    (city: any, index: number, self: any[]) =>
                        index ===
                        self.findIndex(
                            (c) =>
                                c.name === city.name && c.country === city.country
                        )
                )
                .slice(0, 8); // Limit to 8 results

            return cities;
        } catch (error) {
            console.error("City search error:", error);
            return [];
        }
    },
});
