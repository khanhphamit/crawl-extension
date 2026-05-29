// Config mặc định cho crawler

export const CrawlConfig = {
  // Cấu hình URL
  url: {
    baseUrl: "https://thuvienphapluat.vn/page/tim-van-ban.aspx?keyword=&area=0&type=0&status=0&lan=1&org=0&signer=0&match=True&sort=1&bdate=16/03/2025&edate=02/07/2025&page=",
    apiEndpoint: "http://localhost:8909/api/crawl",
  },

  // Cấu hình pagination
  pagination: {
    minPage: 1,
    maxPage: 1,
    pageParamName: "page",
  },

  // Cấu hình selector cho list page (trang danh sách)
  listPageSelectors: {
    itemContainer: "#block-info #block-info-advan .content-0, .content-1",
    linkSelector: "p.nqTitle a",
    nameSelector: "p.nqTitle a",
    lawIdSelector: "p.nqTitle",
    lawIdAttribute: "lawid",
    datePublishedSelector: ".right-col p:nth-child(1)",
    dateEffectiveSelector: ".right-col p:nth-child(2)",
    statusSelector: ".right-col p:nth-child(3)",
    lastUpdatedSelector: ".right-col p:nth-child(4)",
  },

  // Cấu hình selector cho detail page (trang chi tiết)
  detailPageSelectors: {
    soHieuSelector: "#divThuocTinh table tr:nth-child(1) td:nth-child(2)",
    loaiVanBanSelector: "#divThuocTinh table tr:nth-child(1) td:nth-child(5)",
    noibanHanhSelector: "#divThuocTinh table tr:nth-child(2) td:nth-child(2)",
    ngayBanHanhSelector: "#divThuocTinh table tr:nth-child(3) td:nth-child(2)",
    ngayHieuLucSelector: "#divThuocTinh table tr:nth-child(3) td:nth-child(5)",
    ngayCapNhatSelector: "#divThuocTinh table tr:nth-child(4) td:nth-child(2)",
    tinhTrangSelector: "#divThuocTinh table tr:nth-child(5) td:nth-child(3)",
    contentSelector: ".content1",
    luocDoButtonSelector: "#aLuocDo",
    luocDoContentSelector: "#tab4",
  },

  // Cấu hình batch API
  batch: {
    batchSize: 10, // Sau bao nhiêu records thì gọi API (mặc định 1 để test)
    apiMethod: "POST",
    apiTimeout: 30000, // 30 seconds
  },

  // Cấu hình delay
  delay: {
    delayMultiplier: 1, // Hệ số tốc độ (1 = bình thường, 2 = chậm gấp 2)
    minDelay: 500, // ms
    maxDelay: 2000, // ms
    pageLoadTimeout: 30000, // ms - thời gian chờ page load
  },

  // Cấu hình logging
  logging: {
    verbose: true, // Log chi tiết
    excludeFieldsFromLog: ["content"], // Không log những field này
  },
};

export const defaultConfig = {
  crawlConfig: CrawlConfig,
};
