class Follow < ApplicationRecord
  belongs_to :follower, class_name: "User"
  belongs_to :followed, class_name: "User"

  validates :follower_id, presence: true
  validates :followed_id, presence: true
  validates :followed_id, uniqueness: { scope: :follower_id }

  validate :not_follow_self

  private

  def not_follow_self
    errors.add(:base, "自分自身はフォローできません") if follower_id == followed_id
  end
end