class Post < ApplicationRecord
  belongs_to :user, optional: false
  belongs_to :pin, optional: true

  enum visibility: { everyone: 0, company_only: 1, private_: 2 }, _prefix: :visibility

  has_many_attached :media
  validate :media_count_limit

  if defined?(ActiveStorageValidations)
    validates :media,
    content_type: [ /\Aimage\/.*\z/, /\Avideo\/.*\z/ ],
    size: { less_than: 200.megabytes }
  end

  private
  def media_count_limit
    count =
      if media.attachments.loaded?
        media.attachments.size
      else
        media.count
      end
    if count > 10
      errors.add(:media, "は合計10個までアップロードできます")
    end
  end
end
