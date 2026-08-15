import unittest

from backend.app.agents.pipeline import (
    has_category_evidence,
    has_business_evidence,
    has_location_evidence,
    is_blocked_source,
    is_likely_official_site,
)


class PipelineValidationTests(unittest.TestCase):
    def test_blocks_non_business_sources(self):
        self.assertTrue(is_blocked_source("https://www.youtube.com/watch?v=test"))
        self.assertTrue(is_blocked_source("https://example.edu/file.pdf"))
        self.assertTrue(is_blocked_source("https://maps.apple.com/place"))

    def test_requires_business_evidence(self):
        self.assertTrue(has_business_evidence("Pizzeria Roma", "Pizzeria Roma Guadalajara"))
        self.assertFalse(has_business_evidence("Pizzeria Roma", "Hotel en Guadalajara"))

    def test_detects_category(self):
        self.assertTrue(has_category_evidence("Pizzerias", "Pizza artesanal y horno de leña"))
        self.assertFalse(has_category_evidence("Pizzerias", "Hotel boutique con spa"))

    def test_rejects_editorial_domain_as_official_site(self):
        self.assertFalse(
            is_likely_official_site(
                "Pizzeria La Piazza",
                "thelosangelesbeat.com",
                "Articulo sobre una pizzeria en Guadalajara",
            )
        )
        self.assertTrue(
            is_likely_official_site(
                "Pizzeria Capri",
                "capripizzasubs.com",
                "Menu, contacto y delivery de Pizzeria Capri",
            )
        )

    def test_requires_location_context(self):
        self.assertTrue(has_location_evidence("Guadalajara", "Dirección: Av. Vallarta, Guadalajara"))
        self.assertFalse(has_location_evidence("Guadalajara", "Artículo sobre restaurantes en Guadalajara"))


if __name__ == "__main__":
    unittest.main()
