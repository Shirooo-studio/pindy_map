class Pin < ApplicationRecord
  belongs_to :user

  enum visibility: { everyone: 0, company_only: 1, private_: 2 }, _prefix: :visibility

  validates :name, :latitude, :longitude, presence: true
  validates :google_place_id, uniqueness: { scope: :user_id }, allow_nil: true

  def lat_f = latitude.to_f
  def lng_f = longitude.to_f

  alias_attribute :place_id, :google_place_id
end
