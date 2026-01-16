export async function getAddressFromCoords(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        const addr = data.address;
        return {
            street: addr.road || addr.suburb || "",
            barangay: addr.neighbourhood || addr.village || addr.hamlet || "",
            zipCode: addr.postcode || "",
            city: addr.city || addr.town || "Quezon City"
        };
    } catch (err) {
        console.error(err);
        return null;
    }
}