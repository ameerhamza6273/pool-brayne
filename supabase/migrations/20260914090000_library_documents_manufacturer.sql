-- Client meeting 2026-09: "we can put a drop down in there and then go into each one of these
-- PDFs and say, this is the category and this is what it is" (category AND manufacturer/vendor).
alter table library_documents add column manufacturer text;
