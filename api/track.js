export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const tracking = String(req.query.tracking || "").trim();

  if (!tracking) {
    return res.status(400).json({
      ok: false,
      error: "Takip numarası gerekli."
    });
  }

  const token = process.env.KARGONOMI_TOKEN;

  if (!token) {
    return res.status(500).json({
      ok: false,
      error: "Kargonomi bağlantısı yapılandırılmamış."
    });
  }

  const normalize = (value) =>
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

  const wanted = normalize(tracking);

  const trackingFields = [
    "shipping_webservice_tracking_code",
    "shipping_tracking_code",
    "tracking_code",
    "tracking_number",
    "trackingNumber",
    "tracking_no",
    "trackingNo",
    "cargo_tracking_number",
    "cargoTrackingNumber",
    "shipment_tracking_number",
    "shipmentTrackingNumber",
    "barcode",
    "cargo_barcode",
    "cargoBarcode",
    "shipping_barcode",
    "reference_number",
    "shipping_reference_number"
  ];

  function getShipments(json) {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.shipments)) return json.shipments;
    if (Array.isArray(json?.data?.shipments)) return json.data.shipments;
    if (Array.isArray(json?.items)) return json.items;
    if (Array.isArray(json?.results)) return json.results;
    return [];
  }

  function findShipment(shipments) {
    return shipments.find((shipment) =>
      trackingFields.some(
        (field) => normalize(shipment?.[field]) === wanted
      )
    );
  }

  try {
    let page = 1;
    let lastPage = 1;

    do {
      const response = await fetch(
        `https://app.kargonomi.com.tr/api/v1/shipments?page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
          }
        }
      );

      if (response.status === 401 || response.status === 403) {
        return res.status(502).json({
          ok: false,
          error: "Kargonomi API yetkilendirmesi başarısız."
        });
      }

      if (!response.ok) {
        return res.status(502).json({
          ok: false,
          error: `Kargonomi API hatası (${response.status}).`
        });
      }

      const json = await response.json();
      const shipments = getShipments(json);

      const found = findShipment(shipments);

      if (found) {
        const shipmentId =
          found.id ||
          found.shipment_id ||
          found.shipmentId;

        let detail = found;

        if (shipmentId) {
          try {
            const detailResponse = await fetch(
              `https://app.kargonomi.com.tr/api/v1/shipments/${shipmentId}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/json"
                }
              }
            );

            if (detailResponse.ok) {
              const detailJson = await detailResponse.json();
              detail =
                detailJson?.data ||
                detailJson?.shipment ||
                detailJson;
            }
          } catch (e) {}
        }

        return res.status(200).json({
          ok: true,

          tracking:
            detail?.shipping_webservice_tracking_code ||
            found?.shipping_webservice_tracking_code ||
            tracking,

          shipmentId:
            shipmentId || "",

          status:
            detail?.status_label ||
            detail?.shipping_status ||
            detail?.status_name ||
            detail?.status ||
            found?.status_label ||
            found?.status ||
            "Kargo kaydı bulundu",

          carrier:
            detail?.shipping_provider_name ||
            detail?.shipping_company_name ||
            detail?.cargo_company ||
            found?.shipping_provider_name ||
            found?.shipping_company_name ||
            "",

          location:
            detail?.location ||
            detail?.current_location ||
            detail?.last_location ||
            detail?.shipping_location ||
            "",

          updated:
            detail?.updated_at ||
            detail?.status_updated_at ||
            found?.updated_at ||
            "",

          movements:
            detail?.movements ||
            detail?.tracking_history ||
            detail?.shipping_movements ||
            detail?.cargo_movements ||
            []
        });
      }

      lastPage =
        Number(
          json?.meta?.last_page ||
          json?.last_page ||
          json?.data?.meta?.last_page ||
          1
        ) || 1;

      page++;

    } while (page <= lastPage);

    return res.status(404).json({
      ok: false,
      error: "Bu takip numarasına ait kargo kaydı bulunamadı."
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Kargo servisine şu anda ulaşılamıyor."
    });
  }
}
