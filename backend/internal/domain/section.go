package domain

const (
	SectionArticle  = "article"
	SectionOffTopic = "off-topic"
)

func ValidSection(value string) bool {
	return value == SectionArticle || value == SectionOffTopic
}

func NormalizeSection(value string) string {
	if value == SectionOffTopic {
		return SectionOffTopic
	}
	return SectionArticle
}
