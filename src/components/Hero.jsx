import { fmt, salePrice } from "../utils/api";

export function Hero({ featured, setPage }) {
  return (
    <section className="home-hero">
      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <span className="home-hero-eyebrow">A MORE CONSIDERED CLOSET</span>
          <h1>Good style.<br /><span>Second life.</span></h1>
          <p>One-of-a-kind finds, thoughtfully picked. Discover pieces with a past and make them part of your story.</p>
          <button type="button" onClick={() => setPage("products")}>
            EXPLORE THE COLLECTION <span aria-hidden="true">→</span>
          </button>
          <div className="home-hero-note"><span aria-hidden="true">✦</span> Curated pre-loved fashion</div>
        </div>

        {featured.length > 0 ? (
          <div className={`home-featured-grid home-featured-count-${Math.min(featured.length, 3)}`}>
            {featured.slice(0, 3).map((product, index) => (
              <article className={`home-feature-card home-feature-card-${index + 1}`} key={product.id}>
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    decoding="async"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="home-feature-placeholder" aria-hidden="true">F</div>
                )}
                <div className="home-feature-caption">
                  <span>{product.category || "CURATED FIND"}</span>
                  <h2>{product.title}</h2>
                  <p>{fmt(salePrice(product.price, product.discount))}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="home-featured-empty" aria-label="FITCHEQUE curated fashion">
            <span>FITCHEQUE</span>
            <p>Find a piece that feels like you.</p>
          </div>
        )}
      </div>
    </section>
  );
}
