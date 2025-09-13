class Pin < ApplicationRecord
  belongs_to :user

  enum visibility: { everyone: 0, company_only: 1, private_: 2 }, _prefix: :visibility

  validates :name, :latitude, :longitude, presence: true
  validates :place_id, uniqueness: true, allow_blank: true
end
